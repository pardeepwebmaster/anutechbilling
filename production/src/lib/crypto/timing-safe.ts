/**
 * Constant-time string comparison for secrets (cron bearer tokens, etc.).
 * Server-only (uses node `crypto`). Returns false on empty or length mismatch.
 */
import { timingSafeEqual } from "crypto";

export function timingSafeEqualStr(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
