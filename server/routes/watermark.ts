/**
 * CEL-MON-002: Watermark Upsell Routes
 *
 * POST /api/projects/:id/watermark/checkout
 *   → Creates a Stripe Checkout Session (one-time $9 payment) and returns { url }.
 *     The session metadata includes projectId so the webhook can flip the flag.
 *
 * POST /api/stripe/webhooks
 *   → Receives Stripe events. Verifies the signature using req.rawBody (already
 *     captured by express.json({ verify }) in server/index.ts).
 *     On checkout.session.completed for product=watermark_removal, sets
 *     projects.watermark_removed = true.
 *
 * GET /api/projects/:id/watermark/status
 *   → Returns { watermarkRemoved: boolean } for the project dashboard.
 */

import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getSessionUser } from "../storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

async function requireOwner(
  req: Request,
  res: Response,
  projectId: number
): Promise<boolean> {
  const userId = getSessionUser(extractToken(req));
  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return false;
  }
  const project = await storage.getProject(projectId);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return false;
  }
  if (project.ownerId !== userId) {
    res.status(403).json({ message: "Only the project owner can do this" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Stripe helpers — loaded lazily so the server starts without STRIPE_SECRET_KEY
// ---------------------------------------------------------------------------

async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY env var is not set");
  return new Stripe(key, { apiVersion: "2024-06-20" as any });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerWatermarkRoutes(app: Express) {
  // -------------------------------------------------------------------------
  // POST /api/projects/:id/watermark/checkout
  // Creates a Stripe Checkout Session and returns the redirect URL.
  // -------------------------------------------------------------------------
  app.post("/api/projects/:id/watermark/checkout", async (req: Request, res: Response) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!(await requireOwner(req, res, projectId))) return;

    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if ((project as any).watermarkRemoved) {
      return res.status(400).json({ message: "Watermark is already removed for this project" });
    }

    let stripe: Awaited<ReturnType<typeof getStripe>>;
    try {
      stripe = await getStripe();
    } catch (e: any) {
      return res.status(503).json({ message: e.message });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:5000";

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: 900, // $9.00
              product_data: {
                name: "Remove Watermark",
                description: `Remove the PREVIEW watermark from all shared links for "${project.title}"`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          product: "watermark_removal",
          projectId: String(projectId),
        },
        success_url: `${appUrl}/#/projects/${projectId}?watermark_success=1`,
        cancel_url: `${appUrl}/#/projects/${projectId}`,
      });

      // Persist the session ID so we can cross-check in the webhook
      await storage.updateProject(projectId, {
        watermarkStripeSessionId: session.id,
      } as any);

      return res.json({ url: session.url });
    } catch (e: any) {
      console.error("[watermark] Stripe checkout error:", e);
      return res.status(500).json({ message: `Stripe error: ${e.message}` });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/projects/:id/watermark/status
  // -------------------------------------------------------------------------
  app.get("/api/projects/:id/watermark/status", async (req: Request, res: Response) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!(await requireOwner(req, res, projectId))) return;
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    return res.json({ watermarkRemoved: !!(project as any).watermarkRemoved });
  });

  // -------------------------------------------------------------------------
  // POST /api/stripe/webhooks
  // Stripe sends raw bytes; we verify HMAC with req.rawBody.
  // -------------------------------------------------------------------------
  app.post("/api/stripe/webhooks", async (req: Request, res: Response) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[watermark] STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ message: "Missing stripe-signature header" });

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) return res.status(400).json({ message: "Raw body unavailable" });

    // ── Manual HMAC verification matching Stripe's v1 scheme ──────────────
    // Stripe signature header format:
    //   t=<timestamp>,v1=<hmac_hex>[,v1=<hmac_hex>,...]
    // We verify at least one v1 element matches.
    let event: any;
    try {
      const sigHeader = Array.isArray(signature) ? signature[0] : signature;
      const parts = sigHeader.split(",");
      const tPart = parts.find((p: string) => p.startsWith("t="));
      const v1Parts = parts.filter((p: string) => p.startsWith("v1="));

      if (!tPart || v1Parts.length === 0) {
        return res.status(400).json({ message: "Malformed stripe-signature header" });
      }

      const timestamp = tPart.slice(2);
      const payload = `${timestamp}.${rawBody.toString("utf8")}`;
      const expected = createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");
      const expectedBuf = Buffer.from(expected, "utf8");

      const valid = v1Parts.some((part: string) => {
        const received = part.slice(3);
        try {
          return timingSafeEqual(
            expectedBuf,
            Buffer.from(received, "utf8")
          );
        } catch {
          return false;
        }
      });

      if (!valid) {
        return res.status(400).json({ message: "Webhook signature verification failed" });
      }

      event = JSON.parse(rawBody.toString("utf8"));
    } catch (e: any) {
      console.error("[watermark] Webhook parse error:", e);
      return res.status(400).json({ message: `Webhook error: ${e.message}` });
    }

    // ── Handle events ─────────────────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const meta = session.metadata ?? {};

      if (meta.product === "watermark_removal" && meta.projectId) {
        const projectId = parseInt(String(meta.projectId), 10);
        if (!isNaN(projectId)) {
          await storage.updateProject(projectId, {
            watermarkRemoved: true,
          } as any);
          console.log(`[watermark] Removed watermark for project ${projectId} (session ${session.id})`);
        }
      }
    }

    // Always acknowledge promptly
    return res.json({ received: true });
  });
}
