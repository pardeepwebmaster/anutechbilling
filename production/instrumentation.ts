/**
 * Next.js 14 instrumentation hook — Sentry server + edge init bridge.
 *
 * Next calls `register()` once at server boot. We forward to the appropriate
 * Sentry config based on runtime, but only if SENTRY_DSN is set (lazy import
 * to avoid the @sentry/nextjs bundle penalty during local dev without a DSN).
 */
export async function register() {
  // Diagnostic boot log — confirms instrumentation.ts ran on Cloud Run.
  // Will appear once at cold-start. Safe to leave in; ~80 bytes per boot.
  // eslint-disable-next-line no-console
  console.log(
    `[instrumentation] register() runtime=${process.env.NEXT_RUNTIME ?? "?"} ` +
      `SENTRY_DSN=${process.env.SENTRY_DSN ? "set" : "MISSING"} ` +
      `NODE_ENV=${process.env.NODE_ENV ?? "?"}`,
  );

  if (!process.env.SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.log("[instrumentation] skipping Sentry init — no SENTRY_DSN");
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // eslint-disable-next-line no-console
    console.log("[instrumentation] loading sentry.server.config");
    await import("./sentry.server.config");
    // eslint-disable-next-line no-console
    console.log("[instrumentation] sentry.server.config loaded ok");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    // eslint-disable-next-line no-console
    console.log("[instrumentation] loading sentry.edge.config");
    await import("./sentry.edge.config");
    // eslint-disable-next-line no-console
    console.log("[instrumentation] sentry.edge.config loaded ok");
  }
}

// Optional: wire up Sentry to receive React Server Component errors.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
