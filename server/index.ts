import "dotenv/config";
import path from "path";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { seedIfEmpty } from "./seed";
import { demoEnabled } from "./demo";
import { startMaintenance } from "./maintenance";
import { registerLorRoutes } from "./lor_routes";
import { registerAudio2Routes } from "./audio2_routes";
import { registerApprovalRoutes } from "./approval_routes";
import { registerArchiveRoutes } from "./archive_routes";
import { registerSpriteSheetRoutes } from "./spritesheet_routes";
import { startLeaderboardCron } from "./leaderboard_cron";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { pool, migrateDatabase } from "./db";
import { checkR2Health } from "./r2";
import { ZodError } from "zod";
import compression from "compression";
import { installFriendlyZodMessages } from "./errors";

installFriendlyZodMessages();

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Every request gets an id (reusing the proxy's X-Request-Id when it's sane) that appears in the access log,
// the response header and 5xx error bodies, so "it broke at 3pm" can be tied to one log line.
declare global {
  namespace Express {
    interface Request { id?: string }
  }
}
app.use((req, res, next) => {
  const incoming = req.get("x-request-id");
  req.id = incoming && /^[\w.-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

// gzip/deflate text compression: the JS bundle drops from ~1MB to ~330KB. Skip what is already
// compressed or streamed: SSE (compression buffers it, breaking the AI chat), images, zips, media.
app.use(
  compression({
    filter: (req, res) => {
      const type = String(res.getHeader("Content-Type") ?? "");
      if (/event-stream|^image\/|^video\/|^audio\/|zip|pdf|octet-stream/i.test(type)) return false;
      return compression.filter(req, res);
    },
  }),
);
const startedAt = Date.now();

const DEFAULT_ALLOWED_ORIGINS = [
  "https://cel-source.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function parseAllowedOrigins(value: string | undefined): Set<string> {
  const origins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(origins && origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS);
}

// CORS: allow credentials only for explicit origins.
// Set CEL_ALLOWED_ORIGINS as a comma-separated list to override the defaults.
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.CEL_ALLOWED_ORIGINS);

// Baseline security headers (no CSP: the client relies on inline styles/scripts).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  if (!origin) {
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  }

  res.header("Vary", "Origin");

  // Browsers attach Origin to module scripts and POSTs even when same-origin, so a
  // request from the host that is serving the app is always fine.
  let sameOrigin = false;
  try {
    sameOrigin = new URL(origin).host === req.get("host");
  } catch {
    // malformed Origin header: fall through to the allowlist check
  }

  if (!sameOrigin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ message: "CORS origin forbidden" });
  }

  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// A single global 1mb parser would reject every JSON route that carries base64
// media (panels, animatics, assets, commissions, clips, spritesheets) before its
// own size check could run, so the limit is chosen per route.
const jsonVerify = (req: IncomingMessage, _res: unknown, buf: Buffer) => {
  req.rawBody = buf;
};
const defaultJson = express.json({ limit: "1mb", verify: jsonVerify });
const mediaJson = express.json({ limit: "16mb", verify: jsonVerify });
const bulkMediaJson = express.json({ limit: "50mb", verify: jsonVerify });

const MEDIA_JSON_ROUTES = [
  /^\/api\/storyboards\/\d+\/panels$/,
  /^\/api\/panels\/\d+$/,
  /^\/api\/projects\/\d+\/animatics$/,
  /^\/api\/projects\/\d+\/assets(\/\d+)?$/,
  /^\/api\/commissions$/,
  /^\/api\/tracks\/\d+\/clips$/,
  /^\/api\/clips\/\d+$/,
  /^\/api\/mcp\/upload_asset$/,
  /^\/api\/projects\/\d+$/, // PATCH carries the brand logo as a data URL
  /^\/api\/projects\/\d+\/lor_facts$/,
  /^\/api\/lor_facts\/\d+$/,
  /^\/api\/assets\/\d+\/lor_versions$/,
  /^\/api\/aud\/voice_takes$/,
  /^\/api\/inbox(\/\d+)?$/, // scratchpad sketches are saved here as PNG data URLs
];
const BULK_MEDIA_JSON_ROUTES = [
  /^\/api\/storyboards\/\d+\/panels\/bulk$/,
  /^\/api\/projects\/\d+\/spritesheet$/,
];

app.use((req, res, next) => {
  if (BULK_MEDIA_JSON_ROUTES.some((re) => re.test(req.path))) return bulkMediaJson(req, res, next);
  if (MEDIA_JSON_ROUTES.some((re) => re.test(req.path))) return mediaJson(req, res, next);
  return defaultJson(req, res, next);
});

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    ts: new Date().toISOString(),
  });
});

app.get("/ready", async (_req, res) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, db: "not_configured", r2: await checkR2Health(), uptime });
  }

  let db: "connected" | "disconnected" = "disconnected";
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      db = "connected";
    } finally {
      client.release();
    }
  } catch {
    return res.status(503).json({ ok: false, db: "disconnected", r2: await checkR2Health(), uptime });
  }

  const r2 = await checkR2Health();
  const r2Required = !!(process.env.R2_BUCKET && process.env.R2_ENDPOINT);
  const ok = db === "connected" && (!r2Required || r2 === "connected");

  res.status(ok ? 200 : 503).json({ ok, db, r2, uptime });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms req=${req.id}`;
      const contentLength = res.getHeader("content-length");
      if (contentLength) logLine += ` size=${contentLength}b`;
      log(logLine);
    }
  });

  next();
});

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    log("DATABASE_URL is not set; skipping database migrations", "migrations");
    return;
  }

  try {
    await migrateDatabase(process.env.CEL_MIGRATIONS_DIR ?? path.resolve(process.cwd(), "migrations"));
    log("database migrations completed", "migrations");
  } catch (err) {
    console.error("Database migration failed:", err);
    // A half-migrated production DB would serve errors for missing tables; fail fast instead.
    if (process.env.NODE_ENV === "production") throw err;
    console.error("Continuing startup in development.");
  }
}

(async () => {
  await runMigrations();
  // Demo accounts use a well-known password, so never seed them in production
  // unless explicitly requested (e.g. for a public demo instance).
  if (demoEnabled()) {
    try {
      await seedIfEmpty();
    } catch (err) {
      console.error("Seed failed; continuing startup:", err);
    }
  }
  startLeaderboardCron();
  startMaintenance();
  await registerRoutes(httpServer, app);
  registerLorRoutes(app);
  registerAudio2Routes(app);
  registerApprovalRoutes(app);
  registerArchiveRoutes(app);
  registerSpriteSheetRoutes(app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: err.message, issues: err.issues });
    }
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

    // Malformed JSON, oversized bodies etc. are the client's problem, not an incident worth a stack trace.
    if (status >= 500) console.error(`Internal Server Error req=${req.id} ${req.method} ${req.path}:`, err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json(status >= 500 ? { message, requestId: req.id } : { message });
  });

  // Unknown API routes must be JSON 404s, not the SPA's index.html (which the client then fails to parse).
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  const listenOptions: { port: number; host: string; reusePort?: boolean } = { port, host };
  if (process.env.REUSE_PORT !== "false") listenOptions.reusePort = true;
  // Render's load balancer reuses upstream connections for up to 60s; Node's default 5s keep-alive
  // closes them first and surfaces as sporadic 502s. Stay above the balancer's idle timeout.
  httpServer.keepAliveTimeout = 120_000;
  httpServer.headersTimeout = 125_000;

  httpServer.listen(listenOptions, () => {
    log(`serving on ${host}:${port}`);
  });

  // Deploys send SIGTERM: stop accepting connections, let in-flight requests finish, close the DB pool.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`${signal} received, shutting down`);
    httpServer.close(() => {
      pool.end().catch(() => {}).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // don't hang forever on stuck connections
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
