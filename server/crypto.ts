// server/crypto.ts
// AES-256-GCM encrypt/decrypt helpers.
// Requires ENCRYPTION_KEY env var: a 64-char hex string (32 bytes).
// Generate one with: openssl rand -hex 32

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    console.warn(
      "ENCRYPTION_KEY is missing or invalid; values will be stored/read without encryption. Generate with: openssl rand -hex 32"
    );
    return null;
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a single string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string produced by encrypt().
 * Throws on tampered ciphertext (GCM auth tag mismatch).
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;

  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
