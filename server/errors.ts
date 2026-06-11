import type { Response } from "express";

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