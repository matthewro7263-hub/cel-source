import { createHash, randomBytes } from "node:crypto";

/** A fresh single-use token: `token` goes in the email link, only `hash` is stored. */
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
