/**
 * Server-only token verification for public quote links (SEC-1).
 * Uses `crypto` → never import this from a client component (use the pure
 * string builders in `accept-link.ts` there instead).
 */
import { timingSafeEqual } from "crypto";

/**
 * Constant-time compare of a caller-supplied token against the stored one.
 * Returns false for any missing/empty/length-mismatched input.
 */
export function quoteTokenMatches(provided: string | null | undefined, actual: string | null | undefined): boolean {
  if (!provided || !actual) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
