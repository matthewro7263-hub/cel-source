// server/crypto.ts
// Single AES-256-GCM implementation used to protect secrets (e.g. project AI keys) at rest.
//
// ENCRYPTION_KEY: a 64-char hex string (32 bytes), generate with `openssl rand -hex 32`.
// Any other non-empty value is accepted for backwards compatibility and is hashed with
// SHA-256 to derive the key. In production the key is mandatory.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

let warned = false;

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY is required in production (generate with: openssl rand -hex 32)");
    }
    if (!warned) {
      warned = true;
      console.warn("ENCRYPTION_KEY is not set; secrets are only base64-encoded (development only).");
    }
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns iv:authTag:ciphertext (all hex-encoded). Without a key (development only)
 * the value is base64-encoded instead.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return Buffer.from(plaintext, "utf8").toString("base64");

  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string produced by encrypt(). Values without ":" are treated as legacy
 * base64. Throws on tampered ciphertext (GCM auth tag mismatch).
 */
export function decrypt(value: string): string {
  if (!value.includes(":")) return Buffer.from(value, "base64").toString("utf8");

  const parts = value.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");
  const key = getKey();
  if (!key) throw new Error("ENCRYPTION_KEY is required to decrypt this value");

  const [ivHex, authTagHex, dataHex] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
