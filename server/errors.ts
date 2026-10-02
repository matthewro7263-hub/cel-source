import type { Response } from "express";
import { ZodError, type ZodIssue } from "zod";

/** Typed HTTP error for route handlers — avoids ad-hoc status juggling. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

/** Normalize unknown errors into a safe client message + status code. */
export function errorPayload(err: unknown): { status: number; message: string } {
  if (isHttpError(err)) {
    return { status: err.status, message: err.message };
  }
  if (err && typeof err === "object" && "status" in err && "message" in err) {
    const status = Number((err as { status: unknown }).status) || 500;
    const message = String((err as { message: unknown }).message) || "Internal Server Error";
    return { status, message };
  }
  return { status: 500, message: "Internal Server Error" };
}

export function sendError(res: Response, err: unknown): Response {
  const { status, message } = errorPayload(err);
  return res.status(status).json({ message });
}

/** "title: Required; budgetRange: Invalid enum value" instead of zod's default JSON blob. */
export function describeZodIssues(issues: ZodIssue[], max = 3): string {
  const parts = issues.slice(0, max).map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  const extra = issues.length - max;
  return parts.join("; ") + (extra > 0 ? ` (+${extra} more)` : "");
}

/**
 * ZodError#message is a JSON dump of every issue, and many handlers send `e.message` straight to the
 * client (where it ends up in a toast). Make it readable once, for every call site.
 */
export function installFriendlyZodMessages() {
  Object.defineProperty(ZodError.prototype, "message", {
    configurable: true,
    get(this: ZodError) {
      return describeZodIssues(this.issues);
    },
  });
}
