/**
 * Signed tenant token for the public expense-claim link (/expense-claim).
 *
 * The link is opened with NO login, so it carries the tenant id + an HMAC
 * signature. The server recomputes the signature and constant-time compares —
 * a tampered/guessed tenant id won't verify. The employee's attendance PIN is
 * the real second factor, and every claim lands 'pending' (owner approves), so
 * this token just routes the form to the right reseller.
 *
 * Secret: reuse PDF_SIGNING_SECRET, else the service-role key (server-only).
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET =
  process.env.PDF_SIGNING_SECRET?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

export function signClaimToken(tenantId: string): string {
  return createHmac("sha256", SECRET).update(`expense-claim:${tenantId}`).digest("hex");
}

export function verifyClaimToken(tenantId: string, sig: string): boolean {
  if (!tenantId || !sig) return false;
  const expected = signClaimToken(tenantId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Full shareable claim link for a tenant. */
export function claimLinkUrl(appUrl: string, tenantId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/expense-claim?tid=${encodeURIComponent(tenantId)}&sig=${signClaimToken(tenantId)}`;
}
