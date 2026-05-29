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
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SENTRY_TEST) {
    return NextResponse.json(
      { error: "sentry-test disabled in production. Set ALLOW_SENTRY_TEST=1 to enable temporarily." },
      { status: 403 },
    );
  }

  // Belt + braces: explicitly capture via Sentry SDK AND throw. Either path
  // should hit Sentry — explicit capture verifies SDK initialised + DSN
  // reachable; the throw exercises the Next.js onRequestError auto-capture.
  const err = new Error(
    `ResellerOS Sentry smoke test ${new Date().toISOString()} — intentional, no action needed`,
  );
  // eslint-disable-next-line no-console
  console.log("[sentry-test] about to captureException");
  const evtId = Sentry.captureException(err, {
    tags: { test: "sentry-smoke", source: "/api/sentry-test" },
  });
  // eslint-disable-next-line no-console
  console.log(`[sentry-test] captureException returned eventId=${evtId}`);

  // Flush ensures the event leaves the process before we throw (otherwise
  // Cloud Run might kill the worker before the HTTP POST to Sentry completes).
  const flushed = await Sentry.flush(2000);
  // eslint-disable-next-line no-console
  console.log(`[sentry-test] flush returned ${flushed}`);

  throw err;
}
