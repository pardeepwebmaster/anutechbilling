/**
 * Customer-deletion guard — pure, unit-tested.
 *
 * MONEY-CORRECTNESS + Zoho-Books parity: `subscriptions.customer_id` is
 * ON DELETE CASCADE (0001_init.sql), so deleting a customer would silently wipe
 * their subscriptions (recurring revenue + renewals). Payments, invoices, quotes
 * and projects only detach (SET NULL) but are real documents / money-legal
 * history. Like Zoho, a customer may be hard-deleted ONLY when it is truly empty
 * — NO subscriptions, payments, invoices, quotes, or projects (a mistake /
 * duplicate / test record). Anything else → archive instead. The authoritative
 * check runs server-side in the delete_customer() RPC (migration 0174); this
 * twin drives the client (explain the block) and is unit-tested.
 */
export interface CustomerMoneyCounts {
  subscriptions: number;
  payments: number;
  invoices: number;
  quotes: number;
  projects: number;
}

/** Returns a human reason when the customer is NOT safe to delete, else null. */
export function customerDeleteBlockReason(counts: CustomerMoneyCounts): string | null {
  const parts: string[] = [];
  if (counts.subscriptions > 0) parts.push(`${counts.subscriptions} subscription${counts.subscriptions === 1 ? "" : "s"}`);
  if (counts.payments > 0)      parts.push(`${counts.payments} payment${counts.payments === 1 ? "" : "s"}`);
  if (counts.invoices > 0)      parts.push(`${counts.invoices} invoice${counts.invoices === 1 ? "" : "s"}`);
  if (counts.quotes > 0)        parts.push(`${counts.quotes} quote${counts.quotes === 1 ? "" : "s"}`);
  if (counts.projects > 0)      parts.push(`${counts.projects} project${counts.projects === 1 ? "" : "s"}`);
  if (parts.length === 0) return null;
  return `This customer has ${parts.join(", ")}. A customer can only be deleted when it has no documents — delete those first, or archive the customer instead.`;
}
