/**
 * GET /api/sentry-test
 *
 * Dev/staging utility — throws a server-side error so we can verify Sentry
 * captures it. Disabled in production builds unless ALLOW_SENTRY_TEST=1.
 *
 * Usage:
 *   curl -i https://<host>/api/sentry-test
 *   → 500, error appears in Sentry within ~10 seconds
 */
import { NextResponse } from "next/server";
import "@/lib/sentry"; // side-effect import — guarantees Sentry init on Cloud Run
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SENTRY_TEST) {
    return NextResponse.json(
      { error: "sentry-test disabled in production. Set ALLOW_SENTRY_TEST=1 to enable temporarily." },
      { status: 403 },
    );
  }

  const err = new Error(
    `ResellerOS Sentry smoke test ${new Date().toISOString()} — intentional, no action needed`,
  );
  Sentry.captureException(err, {
    tags: { test: "sentry-smoke", source: "/api/sentry-test" },
  });
  // Flush ensures the event leaves the process before we throw (otherwise
  // Cloud Run might kill the worker before the HTTP POST to Sentry completes).
  await Sentry.flush(2000);

  throw err;
}
