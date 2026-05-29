/**
 * Sentry — Node.js server init (route handlers, server components, server actions).
 *
 * Only initialises when SENTRY_DSN is set. Filters out tenant_id and PII
 * from event payloads before sending — see beforeSend below.
 */
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN;

// eslint-disable-next-line no-console
console.log(
  `[sentry.server.config] module evaluated, DSN=${DSN ? "set(" + DSN.slice(0, 30) + "...)" : "MISSING"}`,
);

if (DSN) {
  Sentry.init({
    dsn:              DSN,
    environment:      process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Print every event right before transport. Cheap; helps prove SDK
    // reached the send phase. Remove once Sentry capture is confirmed.
    beforeSend(event) {
      // eslint-disable-next-line no-console
      console.log(
        `[sentry.server.config] beforeSend event=${event.event_id} type=${event.type ?? "error"} msg=${(event.exception?.values?.[0]?.value ?? event.message ?? "").slice(0, 80)}`,
      );
      // Strip sensitive fields from error context before transmission.
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
  // eslint-disable-next-line no-console
  console.log("[sentry.server.config] Sentry.init completed");
} else {
  // eslint-disable-next-line no-console
  console.log("[sentry.server.config] Sentry.init skipped — no DSN");
}
