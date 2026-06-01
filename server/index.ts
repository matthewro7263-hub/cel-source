import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { seedIfEmpty } from "./seed";
import { registerLorRoutes } from "./lor_routes";
import { registerAudio2Routes } from "./audio2_routes";
import { registerApprovalRoutes } from "./approval_routes";
import { registerArchiveRoutes } from "./archive_routes";
import { registerSpriteSheetRoutes } from "./spritesheet_routes";
import { createServer } from "node:http";

const app = express();
app.set("trust proxy", 1);

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

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  if (!origin) {
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  }

  res.header("Vary", "Origin");

  if (!ALLOWED_ORIGINS.has(origin)) {
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

app.use(
  express.json({
    limit: "50mb", // increased for spritesheet payloads
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await seedIfEmpty();
  await registerRoutes(httpServer, app);
  registerLorRoutes(app);
  registerAudio2Routes(app);
  registerApprovalRoutes(app);
  registerArchiveRoutes(app);
  registerSpriteSheetRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
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
  httpServer.listen(listenOptions, () => {
    log(`serving on ${host}:${port}`);
  });
})();
