/**
 * Payments — money in, reconciled and ready for GST invoice.
 * Queries the `payments` table directly (supports multiple per quote = installments).
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  usePayments,
  useOutstandingReceivables,
  useMarkReminderSent,
  useSuspendSubscription,
  useResumeSubscription,
  useWriteOffSubscription,
  type Payment,
  type OutstandingRow,
} from "@/lib/queries/payments";
import { useQuotes } from "@/lib/queries/quotes";
import { useCustomers } from "@/lib/queries/customers";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { ReceiptVoucherDialog } from "@/components/features/quotes/receipt-voucher-dialog";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { KPI } from "@/components/shared/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate } from "@/lib/utils";

const STATUS_TABS: TabBarItem[] = [
  { id: "all",       label: "All" },
  { id: "received",  label: "Received",  dot: "emerald" },
  { id: "refunded",  label: "Refunded",  dot: "rose" },
];

const METHOD_META: Record<string, { label: string; icon: string }> = {
  upi:           { label: "UPI",        icon: "rupee" },
  razorpay:      { label: "Razorpay",   icon: "zap" },
  bank_transfer: { label: "Bank",       icon: "receipt" },
  cheque:        { label: "Cheque",     icon: "file" },
  cash:          { label: "Cash",       icon: "rupee" },
  other:         { label: "Other",      icon: "info" },
};

export default function PaymentsPage() {
  const [tab, setTab]       = React.useState<"all" | "received" | "refunded">("all");
  const [search, setSearch] = React.useState("");

  const { data: payments, isLoading, error, refetch } = usePayments();
  const { data: quotes } = useQuotes();
  const { data: outstanding } = useOutstandingReceivables();
  const { data: customers } = useCustomers();
  const { data: me } = useCurrentUser();
  const markReminderSent  = useMarkReminderSent();
  const suspendSub        = useSuspendSubscription();
  const resumeSub         = useResumeSubscription();
  const writeOffSub       = useWriteOffSubscription();

  // Build a lookup: quoteId → quote (for customer name + status context)
  const quoteById = React.useMemo(() => {
    const m = new Map<string, { customerName: string; paymentStatus: string; invoiceId: string | null; customerId: string | null }>();
    for (const q of quotes ?? []) {
      m.set(q.id, {
        customerName:  q.customer_name,
        paymentStatus: q.payment_status,
        invoiceId:     q.invoice_id,
        customerId:    q.customer_id,
      });
    }
    return m;
  }, [quotes]);

  // Lookup: customerId → full customer record (for GSTIN, address, email on receipt voucher)
  const customerById = React.useMemo(() => {
    const m = new Map<string, NonNullable<typeof customers>[number]>();
    for (const c of customers ?? []) m.set(c.id, c);
    return m;
  }, [customers]);

  // Filter
  const filtered = (payments ?? []).filter((p) => {
    if (tab !== "all" && p.status !== tab) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const quoteCtx = quoteById.get(p.quote_id);
    return (
      p.quote_id.toLowerCase().includes(s) ||
      (p.reference?.toLowerCase().includes(s) ?? false) ||
      p.method.toLowerCase().includes(s) ||
      (quoteCtx?.customerName.toLowerCase().includes(s) ?? false)
    );
  });

  const counts: Record<string, number> = { all: payments?.length ?? 0 };
  for (const p of payments ?? []) counts[p.status] = (counts[p.status] ?? 0) + 1;
  const tabsWithCounts = STATUS_TABS.map((t) => ({ ...t, count: counts[t.id] ?? 0 }));

  // KPIs
  const allReceived = (payments ?? []).filter((p) => p.status === "received");
  const totalCollected = allReceived.reduce((s, p) => s + p.amount, 0);

  // Awaiting-invoice: quotes with payment_status = 'received' (fully paid, no invoice yet)
  const awaitingInvoiceQuotes = (quotes ?? []).filter((q) => q.payment_status === "received");
  const awaitingInvoiceTotal = awaitingInvoiceQuotes.reduce((s, q) => s + (q.amount ?? 0), 0);

  // Partial payments (quotes with status=partial)
  const partialQuotes = (quotes ?? []).filter((q) => q.payment_status === "partial");

  const mtdStart = new Date(); mtdStart.setDate(1);
  const mtdCollected = allReceived
    .filter((p) => new Date(p.received_at) >= mtdStart)
    .reduce((s, p) => s + p.amount, 0);

  // Method breakdown
  const methodBreakdown: Record<string, number> = {};
  for (const p of allReceived) {
    methodBreakdown[p.method] = (methodBreakdown[p.method] ?? 0) + 1;
  }
  const topMethod = Object.entries(methodBreakdown).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Revenue</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Payments</h1>
          <p className="text-sm text-ink-3 mt-1">
            All payments received · partial / installments supported · ready for GST invoice
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="download" onClick={() => toast.info("Export coming soon")}>
            Export CSV
          </Button>
          <Button asChild variant="primary" icon="receipt">
            <Link href="/invoices">View Invoices →</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && payments && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI
            label="Collected MTD"
            value={rupee(mtdCollected, { compact: true })}
            trend="this month"
            trendKind="up"
            icon="rupee"
          />
          <KPI
            label="Partial quotes"
            value={partialQuotes.length}
            trend={`${rupee(partialQuotes.reduce((s, q) => s + ((q.amount ?? 0) - (q.payment_amount ?? 0)), 0), { compact: true })} pending`}
            trendKind={partialQuotes.length > 0 ? "down" : "neutral"}
            icon="clock"
          />
          <KPI
            label="Awaiting invoice"
            value={rupee(awaitingInvoiceTotal, { compact: true })}
            trend={`${awaitingInvoiceQuotes.length} fully-paid quote${awaitingInvoiceQuotes.length === 1 ? "" : "s"}`}
            trendKind={awaitingInvoiceQuotes.length > 0 ? "down" : "neutral"}
            icon="alert"
          />
          <KPI
            label="Top method"
            value={topMethod ? METHOD_META[topMethod[0]]?.label ?? topMethod[0] : "—"}
            trend={topMethod ? `${topMethod[1]} payment${topMethod[1] === 1 ? "" : "s"}` : "no data"}
            trendKind="neutral"
            icon={topMethod ? (METHOD_META[topMethod[0]]?.icon ?? "rupee") : "rupee"}
          />
        </div>
      )}

      {/* ── Outstanding Receivables — actionable card ── */}
      {outstanding && outstanding.length > 0 && (() => {
        const totalDue = outstanding.reduce((s, o) => s + o.outstanding_amount, 0);
        const overdueCount = outstanding.filter((o) => o.days_outstanding > 30).length;
        return (
          <Card className="border-rose/30 bg-rose-soft/20">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2.5">
                <Icon name="alert" size={18} className="text-rose" />
                <div>
                  <h2 className="font-semibold text-ink">Outstanding receivables · {rupee(totalDue)} due</h2>
                  <p className="text-xs text-ink-3">
                    {outstanding.length} customer{outstanding.length === 1 ? "" : "s"} have outstanding balance
                    {overdueCount > 0 && <> · <b className="text-rose">{overdueCount} overdue 30+ days</b></>}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-hairline bg-paper overflow-x-auto">
              <table className="w-full">
                <thead className="bg-paper-2 border-b border-hairline">
                  <tr>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Customer</th>
                    <th className="text-right p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Paid</th>
                    <th className="text-right p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Outstanding</th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Aging</th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Status</th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Last reminder</th>
                    <th className="text-right p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3 w-72">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((o) => (
                    <OutstandingRowView
                      key={o.subscription_id}
                      o={o}
                      onReminder={async () => {
                        await markReminderSent.mutateAsync(o.subscription_id);
                        const subject = `Payment reminder · ${rupee(o.outstanding_amount)} pending`;
                        const body =
                          `Hi ${o.customer_name},\n\nThis is a friendly reminder that ${rupee(o.outstanding_amount)} is still pending against ` +
                          `your subscription for ${o.plan} (started ${formatDate(o.first_payment_at)}).\n\n` +
                          `You've paid ${rupee(o.paid_amount)} of ${rupee(o.total_quote_amount)}.\n\n` +
                          `Please complete the payment at your earliest convenience to keep your service uninterrupted.\n\n— Anutech Digital`;
                        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      }}
                      onSuspend={() => {
                        if (confirm(`Pause subscription for ${o.customer_name}?\n\nThis pauses your service tracking. You'll need to suspend the actual licenses via Google CSP / M365 admin separately.`)) {
                          suspendSub.mutate(o.subscription_id);
                        }
                      }}
                      onResume={() => resumeSub.mutate(o.subscription_id)}
                      onWriteOff={() => {
                        const reason = prompt(`Write off ${rupee(o.outstanding_amount)} from ${o.customer_name}?\n\nThis cancels the subscription and marks the balance as uncollectable.\n\nReason (for audit):`);
                        if (reason && reason.trim().length > 0) {
                          writeOffSub.mutate({ id: o.subscription_id, reason: reason.trim() });
                        }
                      }}
                      recordPaymentHref={o.quote_id ? `/quotes/${o.quote_id}` : null}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-ink-3 mt-2 flex items-center gap-1">
              <Icon name="info" size={11} />
              0–15 days: friendly reminder · 16–30 days: stronger nudge · 30+ days: consider suspending service · 60+ days: write off as bad debt
            </p>
          </Card>
        );
      })()}

      {/* Partial payments hint */}
      {!isLoading && partialQuotes.length > 0 && (
        <GeminiCard
          title="Partial payments outstanding"
          actions={
            <Button asChild size="sm" variant="primary" icon="external">
              <Link href={`/quotes/${partialQuotes[0].id}` as any}>
                Open first one
              </Link>
            </Button>
          }
          compact
        >
          <b>{partialQuotes.length} quote{partialQuotes.length === 1 ? "" : "s"}</b> received
          a partial payment but isn't fully paid yet. Follow up with the customer to collect
          the remaining amount.
        </GeminiCard>
      )}

      {/* Awaiting invoice nudge */}
      {!isLoading && awaitingInvoiceQuotes.length > 0 && (
        <GeminiCard
          title="Generate pending invoices"
          actions={
            <Button asChild size="sm" variant="primary" icon="receipt">
              <Link href={`/quotes/${awaitingInvoiceQuotes[0].id}` as any}>Open first one</Link>
            </Button>
          }
          compact
        >
          <b>{awaitingInvoiceQuotes.length} quote{awaitingInvoiceQuotes.length === 1 ? "" : "s"}</b>{" "}
          fully paid but GST invoice not generated (₹{awaitingInvoiceTotal.toLocaleString("en-IN")} worth).
        </GeminiCard>
      )}

      {/* Tabs + Search */}
      {!isLoading && payments && (
        <>
          <TabBar value={tab} onChange={(v) => setTab(v as typeof tab)} items={tabsWithCounts} />
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="text-xs text-ink-3">
              Showing {filtered.length} of {payments.length} payments · {rupee(totalCollected)} collected all-time
            </div>
            <div className="w-72">
              <Input
                prefix={<Icon name="search" size={14} />}
                placeholder="Quote ID, customer, reference, method…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="alert"
          title="Could not load payments"
          body={error.message}
          action={<Button icon="refresh" onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <Card flush>
          <table className="w-full">
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-hairline">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="p-3"><Skeleton className="h-3 w-full" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !error && payments && payments.length === 0 && (
        <EmptyState
          icon="rupee"
          title="No payments yet"
          body="Once you record a payment on any quote, it shows up here for reconciliation and invoicing."
          action={
            <Button asChild icon="external">
              <Link href="/quotes">Go to Quotes</Link>
            </Button>
          }
        />
      )}

      {/* Filtered empty */}
      {!isLoading && !error && payments && payments.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon="search"
          title="No payments match"
          body={search ? `No results for "${search}".` : `No payments with status "${tab}".`}
          action={<Button icon="x" onClick={() => { setTab("all"); setSearch(""); }}>Clear filters</Button>}
          compact
        />
      )}

      {/* Mobile card list — phones only */}
      {!isLoading && !error && filtered.length > 0 && (
        <ul className="md:hidden space-y-2 mb-3">
          {filtered.map((p) => {
            const ctx = quoteById.get(p.quote_id);
            const customer = ctx?.customerId ? customerById.get(ctx.customerId) : undefined;
            return (
              <li key={p.id}>
                <Link
                  href={`/quotes/${p.quote_id}` as never}
                  className="block bg-paper border border-hairline rounded-lg p-3 active:bg-paper-2/50"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink truncate">
                        {customer?.name ?? ctx?.customerName ?? "—"}
                      </p>
                      <p className="font-mono text-[11px] text-ink-3 mt-0.5">{p.quote_id}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-serif text-base tabular-nums text-ink">{rupee(p.amount)}</p>
                      <p className="text-[10px] text-ink-3">{p.method}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-hairline/60 text-xs">
                    <span className="text-ink-3 truncate">
                      {p.received_at ? formatDate(p.received_at) : "—"}
                      {p.receipt_voucher_no && <> · <span className="font-mono">{p.receipt_voucher_no}</span></>}
                    </span>
                    <Badge
                      kind={p.status === "received" ? "success" : "danger"}
                      size="sm"
                      dot
                    >
                      {p.status}
                    </Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Desktop table */}
      {!isLoading && !error && filtered.length > 0 && (
        <Card flush className="hidden md:block">
          <table className="w-full">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Date</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Customer</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Quote</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Amount</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Method</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Reference</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const ctx = quoteById.get(p.quote_id);
                const customer = ctx?.customerId ? customerById.get(ctx.customerId) : undefined;
                return (
                  <PaymentRowView
                    key={p.id}
                    p={p}
                    ctx={ctx}
                    customer={customer}
                    me={me}
                  />
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Help */}
      {!isLoading && payments && payments.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-ink-3">
          <Icon name="info" size={11} />
          A quote can have multiple payments (installments). Open the quote to see its full payment history.
        </div>
      )}
    </div>
  );
}

// ============================================================
// OutstandingRowView — single row in the outstanding receivables table
// ============================================================
function OutstandingRowView({
  o,
  onReminder,
  onSuspend,
  onResume,
  onWriteOff,
  recordPaymentHref,
}: {
  o: OutstandingRow;
  onReminder: () => void;
  onSuspend:  () => void;
  onResume:   () => void;
  onWriteOff: () => void;
  recordPaymentHref: string | null;
}) {
  const aging =
    o.days_outstanding <= 7   ? "fresh" :
    o.days_outstanding <= 15  ? "warn"  :
    o.days_outstanding <= 30  ? "urgent" : "overdue";
  const ageKind: "success" | "warning" | "danger" =
    aging === "fresh"   ? "success" :
    aging === "warn"    ? "warning" :
                          "danger";

  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-paper-2/40">
      <td className="p-2">
        <div className="font-medium text-sm text-ink">{o.customer_name}</div>
        <div className="text-[10px] text-ink-3">{o.plan}</div>
      </td>
      <td className="p-2 text-right tabular-nums text-xs text-emerald">{rupee(o.paid_amount)}</td>
      <td className="p-2 text-right tabular-nums text-sm font-medium text-rose">{rupee(o.outstanding_amount)}</td>
      <td className="p-2">
        <Badge kind={ageKind} dot>{o.days_outstanding}d</Badge>
      </td>
      <td className="p-2">
        {o.status === "active" ? (
          <Badge kind="success" dot>Active</Badge>
        ) : o.status === "paused" ? (
          <Badge kind="warning" dot>Paused</Badge>
        ) : (
          <Badge kind="muted">{o.status}</Badge>
        )}
      </td>
      <td className="p-2 text-xs text-ink-3">
        {o.last_reminder_at ? formatDate(o.last_reminder_at) : <span className="italic">never</span>}
      </td>
      <td className="p-2 text-right">
        <div className="flex justify-end gap-1 flex-wrap">
          {recordPaymentHref && (
            <Button asChild size="sm" variant="primary" icon="rupee">
              <Link href={recordPaymentHref as any}>Pay</Link>
            </Button>
          )}
          <Button size="sm" icon="mail" onClick={onReminder}>
            Remind
          </Button>
          {o.status === "active" ? (
            <Button size="sm" variant="ghost" onClick={onSuspend}>Suspend</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onResume}>Resume</Button>
          )}
          {o.days_outstanding > 30 && (
            <Button size="sm" variant="ghost" className="!text-rose hover:!bg-rose/10" onClick={onWriteOff}>
              Write off
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function PaymentRowView({
  p,
  ctx,
  customer,
  me,
}: {
  p: Payment;
  ctx?: { customerName: string; paymentStatus: string; invoiceId: string | null; customerId: string | null };
  customer?: {
    name:           string;
    gstin:          string | null;
    contact_email:  string | null;
    state:          string | null;
    state_code:     string | null;
  };
  me?: ReturnType<typeof useCurrentUser>["data"];
}) {
  const methodInfo = METHOD_META[p.method];
  const [receiptOpen, setReceiptOpen] = React.useState(false);

  // Inter-state if customer's state-code differs from tenant's. Default = intra-state.
  const interState = Boolean(
    customer?.state_code &&
    me?.tenantStateCode &&
    customer.state_code !== me.tenantStateCode,
  );

  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-paper-2/40">
      <td className="p-3 text-xs text-ink-2">{formatDate(p.received_at)}</td>
      <td className="p-3 text-sm font-medium text-ink">{ctx?.customerName ?? "—"}</td>
      <td className="p-3">
        <Link
          href={`/quotes/${p.quote_id}` as any}
          className="font-mono text-xs font-semibold text-ink hover:text-amber-ink hover:underline"
        >
          {p.quote_id}
        </Link>
        {ctx?.paymentStatus === "partial" && (
          <div className="text-[10px] text-indigo mt-0.5">partial — open quote to see full history</div>
        )}
      </td>
      <td className="p-3 text-right tabular-nums text-sm font-medium">{rupee(p.amount)}</td>
      <td className="p-3">
        {methodInfo ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Icon name={methodInfo.icon} size={11} className="text-ink-3" />
            {methodInfo.label}
          </span>
        ) : (
          <span className="text-xs text-ink-3">{p.method}</span>
        )}
      </td>
      <td className="p-3 font-mono text-xs text-ink-2 truncate max-w-[160px]">{p.reference ?? "—"}</td>
      <td className="p-3">
        {p.status === "received" ? (
          <Badge kind="success" dot>received</Badge>
        ) : (
          <Badge kind="danger" dot>refunded</Badge>
        )}
        {ctx?.invoiceId && (
          <div className="text-[10px] text-ink-3 font-mono mt-0.5">{ctx.invoiceId}</div>
        )}
        {p.receipt_voucher_no && (
          <div className="text-[10px] text-ink-3 font-mono mt-0.5" title="Receipt voucher number">
            {p.receipt_voucher_no}
          </div>
        )}
      </td>
      <td className="p-3 text-right">
        <div className="flex justify-end gap-1">
          {p.status === "received" && me && (
            <Button
              size="sm"
              icon="file"
              variant="ghost"
              onClick={() => setReceiptOpen(true)}
              title="View / download GST receipt voucher"
            >
              Receipt
            </Button>
          )}
          <Button asChild size="sm" icon="external" variant="ghost">
            <Link href={`/quotes/${p.quote_id}` as any}>Open</Link>
          </Button>
        </div>
        {me && (
          <ReceiptVoucherDialog
            open={receiptOpen}
            onOpenChange={setReceiptOpen}
            payment={p}
            customerName={customer?.name ?? ctx?.customerName ?? "Customer"}
            customerGstin={customer?.gstin}
            customerEmail={customer?.contact_email}
            tenantName={me.tenantName}
            tenantGstin={me.tenantGstin}
            tenantEmail={me.tenantEmail}
            tenantPhone={me.tenantPhone}
            tenantAddress={me.tenantAddress}
            tenantState={me.tenantState}
            interState={interState}
            quoteId={p.quote_id}
          />
        )}
      </td>
    </tr>
  );
}
