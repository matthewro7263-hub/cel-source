import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        // Vite fingerprints everything under /assets, so it can be cached forever; the HTML shell must
        // always be revalidated or users keep loading a stale bundle after a deploy.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // SPA fallback. A request for a missing *file* (e.g. a stale /assets/chunk-abc.js) must 404 instead of
  // returning index.html with a 200, which shows up as an unhelpful "Unexpected token <" in the browser.
  app.use("/{*path}", (req, res) => {
    if (path.extname(req.originalUrl.split("?")[0])) return res.status(404).send("Not found");
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
