/**
 * Next.js 14 instrumentation hook — Sentry server + edge init bridge.
 *
 * Next calls `register()` once at server boot. We forward to the appropriate
 * Sentry config based on runtime, but only if SENTRY_DSN is set (lazy import
 * to avoid the @sentry/nextjs bundle penalty during local dev without a DSN).
 *
 * ⚠️ Known issue (2026-05-29): On Cloud Run + Next.js 14.2.15 + output:
 * "standalone", this hook is NOT actually called at boot (verified via boot
 * logs). As a workaround, server-side init runs via a module-level guard in
 * the routes that need it (see /api/sentry-test). Keep this file for future
 * Next.js upgrades where the hook may start working again — it's a no-op
 * when register() doesn't fire.
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
