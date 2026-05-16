import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, getSessionUser, storage } from "./storage";
import { eq } from "drizzle-orm";
import { biz_festivals, biz_contracts, biz_expenses } from "../shared/biz_schema";

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const userId = getSessionUser(token);
  if (!userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  (req as any).user = user;
  next();
}

// Pre-seeded contract templates
const SEED_CONTRACTS = [
  {
    name: "Commission Agreement (standard)",
    kind: "commission",
    body: `# Commission Agreement

**Artist:** [Your Name]
**Client:** [Client Name]
**Date:** [Date]

## Scope of Work
Artist agrees to create the following artwork as described by Client:
> [Brief description of the commissioned piece]

## Payment
- Total fee: $[AMOUNT]
- Deposit (50%) due before work begins: $[DEPOSIT]
- Balance due upon delivery of final files.

## Revisions
This agreement includes **[N] rounds of revisions**. Additional revisions are billed at $[RATE]/hr.

## Ownership & Rights
Upon full payment, Client receives a **non-exclusive license** to use the artwork for [personal/commercial] purposes. Artist retains the right to display the work in their portfolio.

## Timeline
Estimated completion: **[X] business days** from deposit receipt.

## Cancellation
If Client cancels after work has begun, the deposit is non-refundable.

---
*By proceeding with payment, Client agrees to these terms.*
`,
  },
  {
    name: "Mutual NDA",
    kind: "nda",
    body: `# Mutual Non-Disclosure Agreement

**Party A:** [Your Name / Studio Name]
**Party B:** [Client / Collaborator Name]
**Effective Date:** [Date]

## 1. Purpose
Both parties wish to explore a potential business relationship ("Purpose") and may share confidential information in connection with that Purpose.

## 2. Confidential Information
"Confidential Information" means any non-public information disclosed by either party, including but not limited to: business plans, creative concepts, scripts, designs, and financial data.

## 3. Obligations
Each party agrees to:
- Hold the other party's Confidential Information in strict confidence.
- Not disclose it to any third party without prior written consent.
- Use it solely for the Purpose described above.

## 4. Exclusions
Obligations do not apply to information that:
- Is or becomes publicly known through no breach of this Agreement.
- Was already known to the receiving party before disclosure.

## 5. Term
This Agreement remains in effect for **[2] years** from the Effective Date.

## 6. Return of Information
Upon request, each party will promptly return or destroy the other's Confidential Information.

---
**Party A Signature:** __________________ Date: __________
**Party B Signature:** __________________ Date: __________
`,
  },
  {
    name: "Model / Talent Release",
    kind: "model_release",
    body: `# Model & Talent Release Form

**Production:** [Project / Film Title]
**Producer/Artist:** [Your Name / Studio]
**Date:** [Date]

## Consent
I, **[Model/Talent Name]**, hereby grant [Your Name / Studio] (the "Producer") the irrevocable right and permission to use my name, likeness, image, voice, and performance (the "Materials") captured on [Date] in connection with the above production.

## Permitted Uses
Producer may use the Materials for:
- [Animated film / illustration / promotional material — specify]
- Distribution via [online platforms, festivals, broadcast — specify]
- Portfolio and press coverage.

## Compensation
☐ No compensation (volunteer/personal project)
☐ Agreed compensation: $[AMOUNT]

## Warranties
I confirm that I am at least 18 years of age (or have parental/guardian consent attached), and that I have the full right to enter into this agreement.

## Release
I release Producer from any claims arising from the use of the Materials as described above.

---
**Model / Talent Signature:** __________________ Date: __________
**Print Name:** __________________
**Guardian Signature (if minor):** __________________ Date: __________
`,
  },
];

export function registerBizRoutes(app: Express) {
  // ===== FESTIVALS =====
  const festivalSchema = z.object({
    name: z.string().min(1),
    deadline: z.string().nullable().optional(),
    status: z.enum(["planned", "submitted", "accepted", "rejected"]).optional().default("planned"),
    fee: z.number().optional().default(0),
    notes: z.string().nullable().optional(),
    projectId: z.number().int().nullable().optional(),
  });

  app.get("/api/biz/festivals", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const rows = await db.select().from(biz_festivals).where(eq(biz_festivals.userId, userId));
    res.json(rows);
  });

  app.post("/api/biz/festivals", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    let body: any;
    try { body = festivalSchema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const row = await db.insert(biz_festivals).values({
      userId,
      name: body.name,
      deadline: body.deadline ?? null,
      status: body.status,
      fee: body.fee ?? 0,
      notes: body.notes ?? null,
      projectId: body.projectId ?? null,
      createdAt: new Date(),
    }).returning().then((r) => r[0]);
    res.json(row);
  });

  app.patch("/api/biz/festivals/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    const existing = await db.select().from(biz_festivals).where(eq(biz_festivals.id, id)).then((r) => r[0]);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "No access" });
    const patchSchema = festivalSchema.partial();
    let patch: any;
    try { patch = patchSchema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const updated = await db.update(biz_festivals).set(patch).where(eq(biz_festivals.id, id)).returning().then((r) => r[0]);
    res.json(updated);
  });

  app.delete("/api/biz/festivals/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    const existing = await db.select().from(biz_festivals).where(eq(biz_festivals.id, id)).then((r) => r[0]);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "No access" });
    await db.delete(biz_festivals).where(eq(biz_festivals.id, id));
    res.json({ ok: true });
  });

  // ===== CONTRACTS =====
  const contractSchema = z.object({
    name: z.string().min(1),
    kind: z.enum(["commission", "nda", "model_release"]),
    body: z.string().min(1),
  });

  app.get("/api/biz/contracts", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    // Auto-seed 3 canonical templates on first access
    const existing = await db.select().from(biz_contracts).where(eq(biz_contracts.userId, userId));
    if (existing.length === 0) {
      for (const tmpl of SEED_CONTRACTS) {
        await db.insert(biz_contracts).values({
          userId,
          name: tmpl.name,
          kind: tmpl.kind as any,
          body: tmpl.body,
          createdAt: new Date(),
        });
      }
      const seeded = await db.select().from(biz_contracts).where(eq(biz_contracts.userId, userId));
      return res.json(seeded);
    }
    res.json(existing);
  });

  app.post("/api/biz/contracts", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    let body: any;
    try { body = contractSchema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const row = await db.insert(biz_contracts).values({
      userId,
      name: body.name,
      kind: body.kind,
      body: body.body,
      createdAt: new Date(),
    }).returning().then((r) => r[0]);
    res.json(row);
  });

  app.patch("/api/biz/contracts/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    const existing = await db.select().from(biz_contracts).where(eq(biz_contracts.id, id)).then((r) => r[0]);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "No access" });
    const patchSchema = contractSchema.partial();
    let patch: any;
    try { patch = patchSchema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const updated = await db.update(biz_contracts).set(patch).where(eq(biz_contracts.id, id)).returning().then((r) => r[0]);
    res.json(updated);
  });

  app.delete("/api/biz/contracts/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    const existing = await db.select().from(biz_contracts).where(eq(biz_contracts.id, id)).then((r) => r[0]);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "No access" });
    await db.delete(biz_contracts).where(eq(biz_contracts.id, id));
    res.json({ ok: true });
  });

  // ===== EXPENSES =====
  const expenseSchema = z.object({
    projectId: z.number().int().nullable().optional(),
    date: z.string().min(1),
    category: z.string().min(1),
    amount: z.number(),
    notes: z.string().nullable().optional(),
    receiptUrl: z.string().nullable().optional(),
  });

  app.get("/api/biz/expenses", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const rows = await db.select().from(biz_expenses).where(eq(biz_expenses.userId, userId));
    res.json(rows);
  });

  app.post("/api/biz/expenses", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    let body: any;
    try { body = expenseSchema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const row = await db.insert(biz_expenses).values({
      userId,
      projectId: body.projectId ?? null,
      date: body.date,
      category: body.category,
      amount: body.amount,
      notes: body.notes ?? null,
      receiptUrl: body.receiptUrl ?? null,
      createdAt: new Date(),
    }).returning().then((r) => r[0]);
    res.json(row);
  });

  app.patch("/api/biz/expenses/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    const existing = await db.select().from(biz_expenses).where(eq(biz_expenses.id, id)).then((r) => r[0]);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "No access" });
    const patchSchema = expenseSchema.partial();
    let patch: any;
    try { patch = patchSchema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const updated = await db.update(biz_expenses).set(patch).where(eq(biz_expenses.id, id)).returning().then((r) => r[0]);
    res.json(updated);
  });

  app.delete("/api/biz/expenses/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    const existing = await db.select().from(biz_expenses).where(eq(biz_expenses.id, id)).then((r) => r[0]);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "No access" });
    await db.delete(biz_expenses).where(eq(biz_expenses.id, id));
    res.json({ ok: true });
  });
}
