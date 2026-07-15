/**
 * Capability tokens for public PDF links (/api/v1/documents/{type}/{id}/pdf).
 *
 * DSP embeds these URLs in its UI, so the browser opens them WITHOUT a Bearer
 * header. Instead of a login, each URL carries an unguessable HMAC token bound
 * to (type, id, tenant). The route fetches the doc by id → reads its tenant →
 * recomputes the token → constant-time compares. No token / wrong token → 403.
 *
 * Secret: dedicated PDF_SIGNING_SECRET if set, else the service-role key (always
 * present server-side, never exposed — the HMAC output doesn't reveal it).
 */
import { createHmac, timingSafeEqual } from "crypto";

export type PdfDocType = "invoice" | "quote";

const SECRET =
  process.env.PDF_SIGNING_SECRET?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

export function signPdfToken(type: PdfDocType, id: string, tenantId: string): string {
  return createHmac("sha256", SECRET).update(`${type}:${id}:${tenantId}`).digest("hex");
}

export function verifyPdfToken(type: PdfDocType, id: string, tenantId: string, token: string): boolean {
  if (!token) return false;
  const expected = signPdfToken(type, id, tenantId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Full downloadable URL for a document PDF (what we put in `pdf_url`). */
export function pdfDownloadUrl(appUrl: string, type: PdfDocType, id: string, tenantId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/api/v1/documents/${type}/${encodeURIComponent(id)}/pdf?token=${signPdfToken(type, id, tenantId)}`;
}
