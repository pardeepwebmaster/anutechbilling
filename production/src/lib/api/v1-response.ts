/**
 * Shared JSON responses for the public integration API (/api/v1/*).
 * Error body shape matches the integration spec: { error, code }.
 */
import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export const unauthorized = () =>
  apiError(401, "unauthorized", "Invalid or missing API key");

export const notFound = (message = "Not found") =>
  apiError(404, "not_found", message);

export const badRequest = (message: string) =>
  apiError(400, "bad_request", message);
