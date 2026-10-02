import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import { registerIdParamValidators } from "./params";

let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  registerIdParamValidators(app);
  app.get("/api/projects/:id", (req, res) => res.json({ id: Number(req.params.id) }));
  app.get("/api/share/:token", (req, res) => res.json({ token: req.params.token }));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => server.close());

describe("id param validation", () => {
  test("numeric ids pass", async () => {
    const r = await fetch(`${base}/api/projects/42`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: 42 });
  });
  test("non-numeric ids get 400", async () => {
    for (const bad of ["abc", "1e3", "-1", "12345678901", "1.5"]) {
      expect((await fetch(`${base}/api/projects/${bad}`)).status).toBe(400);
    }
  });
  test("other params are untouched", async () => {
    expect((await fetch(`${base}/api/share/abc123`)).status).toBe(200);
  });
});
