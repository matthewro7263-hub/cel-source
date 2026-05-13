# R2 Uploads + Account Auth — Setup

This branch adds:

- `server/r2.ts` — Cloudflare R2 (S3-compatible) client with presign / download / delete / list helpers.
- `server/uploads_routes.ts` — Express router for presigned uploads (`/api/uploads/*`).
- `server/auth_routes.ts` — Passport-local + argon2 auth (`/api/auth/*`).
- `shared/r2_schema.ts` — Drizzle tables for `users` and `files`.
- `.env.example` — required environment variables (no secrets committed).

## 1. Install dependencies

```bash
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner argon2 zod
```

(`express-session`, `passport`, `passport-local`, `connect-pg-simple`, and `drizzle-orm` are already in `package.json`.)

## 2. Environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — your Postgres URL.
- `SESSION_SECRET` — long random string (`openssl rand -hex 32`).
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — from the **cel-source-uploads R/W** API token in Cloudflare R2.

The bucket, endpoint, and account ID are already set to the live values for `cel-source-uploads`.

## 3. Drizzle schema

Merge `shared/r2_schema.ts` into `shared/schema.ts` (or import its exports there). Then push:

```bash
npm run db:push
```

## 4. Wire Passport + session in `server/index.ts`

```ts
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { configurePassport, authRouter } from "./auth_routes";
import { uploadsRouter } from "./uploads_routes";

const PgStore = connectPgSimple(session);

app.use(express.json());
app.use(
  session({
    store: new PgStore({ conString: process.env.DATABASE_URL!, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 * 30 },
  })
);
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

app.use("/api/auth", authRouter);
app.use("/api/uploads", uploadsRouter);
```

## 5. Client usage (presigned upload)

```ts
async function uploadFile(file: File) {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  }).then((r) => r.json());

  await fetch(presign.url, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  });

  return presign.key; // store this in your DB via a separate /api call if needed
}
```

## 6. CORS on the R2 bucket (if uploading from the browser)

In the Cloudflare R2 dashboard → `cel-source-uploads` → Settings → CORS, add a rule like:

```json
[
  {
    "AllowedOrigins": ["https://your-app.example.com", "http://localhost:5173"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 7. Security notes

- Object keys are scoped to `uploads/<userId>/...`; the routes reject access to keys not owned by the requester.
- Presigned URLs expire in 5 minutes by default.
- Never commit your real `.env`. The R2 secret cannot be retrieved again — regenerate it in Cloudflare if lost.
- For production, run the server behind HTTPS and set `cookie.secure: true`.

## 8. Hosting

GitHub Pages cannot run this server. Recommended hosts: Render, Railway, Fly.io, or Cloudflare Workers (with adapters). Point your Vite client build at the deployed API URL.
