/**
 * Shared JSON responses for the public integration API (/api/v1/*).
 * Error body shape matches the integration spec: { error, code }.
 */
import { NextResponse, type NextRequest } from "next/server";

/**
 * Absolute base URL for building customer-facing links (pdf_url, payment_url)
 * from the ACTUAL host the request came in on — robust against a mis-set
 * NEXT_PUBLIC_APP_URL (a custom domain that isn't live yet would produce dead
 * links). Honours the Cloud Run proxy's x-forwarded-* headers.
 */
export function requestBaseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export const unauthorized = () =>
  apiError(401, "unauthorized", "Invalid or missing API key");

export const notFound = (message = "Not found") =>
  apiError(404, "not_found", message);

export const badRequest = (message: string) =>
  apiError(400, "bad_request", message);
