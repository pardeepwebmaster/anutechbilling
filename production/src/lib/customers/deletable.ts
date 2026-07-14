/**
 * Customer-deletion guard — pure, unit-tested.
 *
 * MONEY-CORRECTNESS: `subscriptions.customer_id` is ON DELETE CASCADE
 * (0001_init.sql), so deleting a customer would silently wipe their
 * subscriptions (recurring revenue + renewals). Payments/invoices/quotes only
 * detach (SET NULL) but represent real money/legal history. So a customer may
 * be deleted ONLY when it has NO subscriptions, payments, or invoices — i.e. a
 * mistake / duplicate / test record with no money history. The authoritative
 * check runs server-side in the delete_customer() RPC; this twin drives the
 * client (disable/explain the delete control) and is unit-tested.
 */
export interface CustomerMoneyCounts {
  subscriptions: number;
  payments: number;
  invoices: number;
}

/** Returns a human reason when the customer is NOT safe to delete, else null. */
export function customerDeleteBlockReason(counts: CustomerMoneyCounts): string | null {
  const parts: string[] = [];
  if (counts.subscriptions > 0) parts.push(`${counts.subscriptions} subscription${counts.subscriptions === 1 ? "" : "s"}`);
  if (counts.payments > 0)      parts.push(`${counts.payments} payment${counts.payments === 1 ? "" : "s"}`);
  if (counts.invoices > 0)      parts.push(`${counts.invoices} invoice${counts.invoices === 1 ? "" : "s"}`);
  if (parts.length === 0) return null;
  return `Can't delete — this customer has ${parts.join(", ")}. Only customers with no money history can be deleted (archive it instead).`;
}
