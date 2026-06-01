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

let _r2: S3Client | null = null;
let _bucket: string | null = null;

export function getR2Bucket(): string {
  if (!_bucket) {
    _bucket = required("R2_BUCKET");
  }
  return _bucket;
}

export function getR2Client(): S3Client {
  if (!_r2) {
    _r2 = new S3Client({
      region: "auto",
      endpoint: required("R2_ENDPOINT"),
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return _r2;
}

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
    Bucket: getR2Bucket(),
    Key: key,
    ContentType: opts.contentType,
  });
  const url = await getSignedUrl(getR2Client(), cmd, { expiresIn });
  return {
    key,
    url,
    method: "PUT",
    headers: { "Content-Type": opts.contentType },
    expiresIn,
  };
}

export async function presignDownload(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }), { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}

export async function headObject(key: string) {
  return getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}

export async function listUserObjects(userId: string, prefix?: string) {
  const Prefix = `uploads/${userId}/${prefix ? prefix + "/" : ""}`;
  return getR2Client().send(new ListObjectsV2Command({ Bucket: getR2Bucket(), Prefix }));
}

export function isOwnedKey(userId: string, key: string): boolean {
  return key.startsWith(`uploads/${userId}/`);
}
