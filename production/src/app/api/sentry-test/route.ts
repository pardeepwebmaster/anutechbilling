/**
 * GET /api/sentry-test
 *
 * Dev/staging utility — throws a server-side error so we can verify Sentry
 * captures it. Disabled in production builds so it can't be hit accidentally.
 *
 * Usage:
 *   curl -i https://resellersos.in/api/sentry-test
 *   → 500, error appears in Sentry within ~10 seconds
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SENTRY_TEST) {
    return NextResponse.json(
      { error: "sentry-test disabled in production. Set ALLOW_SENTRY_TEST=1 to enable temporarily." },
      { status: 403 },
    );
  }
  throw new Error("ResellerOS Sentry smoke test — this is intentional, no action needed");
}
