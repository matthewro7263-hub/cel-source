// server/r2.ts
// Cloudflare R2 client (S3-compatible) for cel-source.
// Requires env vars: R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const R2_BUCKET = required("R2_BUCKET");

export const r2 = new S3Client({
  region: "auto",
  endpoint: required("R2_ENDPOINT"),
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});

export interface PresignUploadOpts {
  userId: string;
  filename: string;
  contentType: string;
  maxBytes?: number; // informational only; enforce on client too
  prefix?: string;   // optional logical folder, e.g. "avatars"
  expiresIn?: number; // seconds, default 300
}

export interface PresignedUpload {
  key: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresIn: number;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export async function presignUpload(opts: PresignUploadOpts): Promise<PresignedUpload> {
  const expiresIn = opts.expiresIn ?? 300;
  const folder = opts.prefix ? `${opts.prefix}/` : "";
  const key = `uploads/${opts.userId}/${folder}${randomUUID()}-${safeName(opts.filename)}`;
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: opts.contentType,
  });
  const url = await getSignedUrl(r2, cmd, { expiresIn });
  return {
    key,
    url,
    method: "PUT",
    headers: { "Content-Type": opts.contentType },
    expiresIn,
  };
}

export async function presignDownload(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export async function headObject(key: string) {
  return r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export async function listUserObjects(userId: string, prefix?: string) {
  const Prefix = `uploads/${userId}/${prefix ? prefix + "/" : ""}`;
  return r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix }));
}

export function isOwnedKey(userId: string, key: string): boolean {
  return key.startsWith(`uploads/${userId}/`);
}
