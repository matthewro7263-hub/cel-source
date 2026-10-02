-- Migration 0016: fix columns whose types/presence drifted from the application code.
-- Idempotent: safe to run repeatedly and on databases created via `drizzle-kit push`.

-- Commission quotes/invoices are read and written by the API and UI but had no columns.
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "quote_cents" integer;
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "invoiced_at" timestamp with time zone;

-- Epoch-millisecond timestamps overflow int4 (e.g. 1790951930694).
ALTER TABLE "scene_time_entries" ALTER COLUMN "started_at" TYPE bigint;
ALTER TABLE "scene_time_entries" ALTER COLUMN "ended_at" TYPE bigint;

-- Logged hours are fractional (2.5h); the column was an integer.
ALTER TABLE "dlt_commission_hours" ALTER COLUMN "hours" TYPE double precision;
