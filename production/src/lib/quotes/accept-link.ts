/**
 * Public quote-link helpers (SEC-1) — PURE string builders, safe to import from
 * client components (no node built-ins). Token VERIFICATION lives server-only in
 * `accept-token.ts` (it uses `crypto`), so keep these two apart.
 *
 * Customer-facing quote links carry an unguessable per-quote token
 * (`quotes.public_token`, migration 0115) instead of relying on the sequential
 * quote id as a secret.
 */

/** Path + token query for a quote's public accept page. */
export function quoteAcceptPath(id: string, token: string): string {
  return `/quote/${encodeURIComponent(id)}/accept?t=${encodeURIComponent(token)}`;
}

/** Absolute customer-facing accept URL (what we email / WhatsApp / copy). */
export function quoteAcceptUrl(appUrl: string, id: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}${quoteAcceptPath(id, token)}`;
}
