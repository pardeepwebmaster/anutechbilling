/**
 * Pure row → integration-spec mappers for /api/v1.
 *
 * These translate ResellerOS DB rows into the exact JSON shapes the DSP spec
 * expects. Kept pure (no I/O) so they're unit-testable.
 *
 * Money note: all amounts are integer INR (rupees), NOT paise — consistent
 * with how ResellerOS stores money internally.
 */
import type {
  Customer as CustomerRow,
  Subscription as SubscriptionRow,
  Invoice as InvoiceRow,
  Quote as QuoteRow,
  Payment as PaymentRow,
} from "@/lib/supabase/database.types";

const CURRENCY = "INR";

/** The external id DSP stores/matches on: readable number, else uuid fallback. */
export function billingCustomerId(c: Pick<CustomerRow, "id" | "customer_number">): string {
  return c.customer_number || c.id;
}

export function mapCustomer(c: CustomerRow, hasActiveSubscription: boolean) {
  return {
    billing_customer_id: billingCustomerId(c),
    name:   c.name,
    email:  c.contact_email,
    domain: c.domain,
    status: hasActiveSubscription ? "active" : "inactive",
  };
}

/** Coarse billing term from the sub's date span (we don't store a cycle field). */
function subscriptionTerm(s: Pick<SubscriptionRow, "start_date" | "renewal_date">): string {
  if (!s.start_date || !s.renewal_date) return "annual";
  const days = (new Date(s.renewal_date).getTime() - new Date(s.start_date).getTime()) / 86_400_000;
  return days >= 330 ? "annual" : "monthly";
}

const SUB_STATUS: Record<SubscriptionRow["status"], string> = {
  active:    "active",
  paused:    "suspended",
  expired:   "expired",
  cancelled: "cancelled",
};

export function mapSubscription(s: SubscriptionRow) {
  return {
    id:           s.id,
    product:      s.plan,
    plan:         subscriptionTerm(s),
    seats:        s.seats,
    status:       SUB_STATUS[s.status] ?? s.status,
    start_date:   s.start_date,
    renewal_date: s.renewal_date,
    amount:       (s.mrr ?? 0) * 12, // annualised (mrr is ₹/month)
    currency:     CURRENCY,
  };
}

const INVOICE_STATUS: Record<InvoiceRow["status"], string> = {
  paid:    "paid",
  overdue: "overdue",
  void:    "cancelled",
  pending: "unpaid",
  draft:   "unpaid",
};

export function mapInvoice(i: InvoiceRow) {
  return {
    id:         i.id,
    number:     i.id, // our id IS the sequential GST number (INV-…)
    amount:     i.amount,
    currency:   CURRENCY,
    status:     INVOICE_STATUS[i.status] ?? i.status,
    issue_date: i.invoice_date,
    due_date:   i.due_date,
    pdf_url:    i.pdf_url,
  };
}

function quoteStatus(q: QuoteRow): string {
  if (q.status === "accepted") return "accepted";
  if (q.status === "expired" || q.status === "rejected") return "expired";
  return "pending";
}

export function mapQuote(q: QuoteRow, appUrl: string) {
  return {
    id:          q.id,
    amount:      q.amount,
    currency:    CURRENCY,
    status:      quoteStatus(q),
    pdf_url:     q.pdf_url,
    payment_url: `${appUrl.replace(/\/$/, "")}/quote/${q.id}/accept`,
  };
}

export function mapPayment(p: PaymentRow, invoiceId: string | null) {
  return {
    id:         p.id,
    amount:     p.amount,
    currency:   CURRENCY,
    reference:  p.reference,
    method:     p.method,
    paid_at:    p.received_at,
    invoice_id: invoiceId,
  };
}
