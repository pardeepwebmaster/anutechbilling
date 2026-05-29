/**
 * Next.js 14 instrumentation hook — Sentry server + edge init bridge.
 *
 * Next calls `register()` once at server boot. We forward to the appropriate
 * Sentry config based on runtime, but only if SENTRY_DSN is set (lazy import
 * to avoid the @sentry/nextjs bundle penalty during local dev without a DSN).
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Optional: wire up Sentry to receive React Server Component errors.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
