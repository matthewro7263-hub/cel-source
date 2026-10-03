/** Demo accounts use a well-known password, so they exist only outside production unless explicitly requested. */
export function demoEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.CEL_SEED_DEMO === "true";
}
