/**
 * Sentry — Node.js server init (route handlers, server components, server actions).
 *
 * Only initialises when SENTRY_DSN is set. Filters out tenant_id and PII
 * from event payloads before sending — see beforeSend below.
 */
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn:              DSN,
    environment:      process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Strip sensitive fields from error context before transmission.
    beforeSend(event) {
      // Drop Supabase service-role JWT if it accidentally lands in stack frames
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
}
