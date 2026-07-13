/**
 * Quote-deletion guard — pure, unit-tested.
 *
 * MONEY-CORRECTNESS: `payments.quote_id` is `ON DELETE CASCADE` (migration
 * 0003_freeze_baseline.sql). Deleting a quote that already carries a recorded
 * payment therefore silently wipes its payment-ledger rows + the audit trail.
 * Any quote whose payment_status shows money in flight (partial / received /
 * invoiced) must NEVER be deletable. Callers use this to hide/disable the
 * delete control; useDeleteQuote enforces it before the destructive write.
 */
import type { Quote } from "@/lib/supabase/database.types";

const QUOTE_PAID_STATES: ReadonlySet<Quote["payment_status"]> = new Set([
  "partial",
  "received",
  "invoiced",
]);

/** Returns a human reason when the quote is NOT safe to delete, else null. */
export function quoteDeleteBlockReason(q: Pick<Quote, "payment_status">): string | null {
  if (q.payment_status && QUOTE_PAID_STATES.has(q.payment_status)) {
    return "This quote has a recorded payment — deleting it would wipe the payment ledger and break the audit trail. Refund/void the payment first.";
  }
  return null;
}
