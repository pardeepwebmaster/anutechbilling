/**
 * Invoices — list matching prototype design.
 *
 * Layout:
 *   - Header: eyebrow "Revenue" + title + subtitle
 *   - Actions: Export GSTR-1 + Push to Zoho + New invoice
 *   - 5 KPIs: Outstanding / Overdue / Collected MTD / Margin MTD / Avg collection
 *   - Status tabs (All/Paid/Pending/Overdue/Draft) with counts
 *   - Table: checkbox / Invoice # / Customer / Date / Due / Amount / Status / Action
 *   - Auto-Sync Status card at bottom
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useInvoices, useQuotesAwaitingInvoice, useGenerateInvoice } from "@/lib/queries/invoices";
import { useQuoteByInvoiceId } from "@/lib/queries/quotes";
import { usePaymentsByQuote } from "@/lib/queries/payments";
import { useProjectPaymentsByInvoice } from "@/lib/queries/projects";
import { useCustomer } from "@/lib/queries/customers";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { TaxInvoiceDialog } from "@/components/features/quotes/tax-invoice-dialog";
import { ReceiptVoucherDialog } from "@/components/features/quotes/receipt-voucher-dialog";
import { isInterStateSupply } from "@/lib/gst/place-of-supply";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatStrip } from "@/components/shared/stat-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { rupee, formatDate, daysBetween } from "@/lib/utils";
import type { Invoice, Payment } from "@/lib/supabase/database.types";

function InvoicesPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  /** Deep-link target: `?open=INV-XXX` auto-opens that invoice's dialog (set by
   *  the "Invoiced" button on the Quotes list). Consumed once + URL cleaned. */
  const openInvoiceId = searchParams.get("open");

  const { data: invoices, isLoading, error, refetch } = useInvoices();
  const { data: pending } = useQuotesAwaitingInvoice();
  const generateInvoice = useGenerateInvoice();
  const [tab, setTab] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingSelected, setPendingSelected] = React.useState<Set<string>>(new Set());
  const [generating, setGenerating] = React.useState(false);

  // Strip the ?open param once the invoice list has loaded the target row,
  // so refreshing the page doesn't keep re-opening the dialog.
  React.useEffect(() => {
    if (!openInvoiceId || !invoices) return;
    if (!invoices.some((i) => i.id === openInvoiceId)) return;
    // Wait a tick so the InvoiceRow's autoOpen effect fires first
    const t = setTimeout(() => router.replace("/invoices" as any), 200);
    return () => clearTimeout(t);
  }, [openInvoiceId, invoices, router]);

  // Counts — split pending into bare-pending vs partial (advances applied).
  // "Partial" is derived (not a DB enum value): status='pending' AND
  // adjusted_advances non-empty. Useful for "how many invoices have SOME
  // money in, balance still owed" — a different operational signal from
  // "absolutely nothing received yet".
  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: invoices?.length ?? 0, partial: 0, pending_bare: 0 };
    for (const inv of invoices ?? []) {
      map[inv.status] = (map[inv.status] ?? 0) + 1;
      const hasAdv = Array.isArray(inv.adjusted_advances) && inv.adjusted_advances.length > 0;
      if (inv.status === "pending") {
        if (hasAdv) map.partial += 1;
        else        map.pending_bare += 1;
      }
    }
    return map;
  }, [invoices]);

  const tabs: TabBarItem[] = [
    { id: "all",     label: "All",     count: counts.all ?? 0 },
    { id: "paid",    label: "Paid",    count: counts.paid ?? 0, dot: "emerald" },
    { id: "partial", label: "Partial", count: counts.partial ?? 0, dot: "amber" },
    { id: "pending", label: "Pending", count: counts.pending_bare ?? 0, dot: "amber" },
    { id: "overdue", label: "Overdue", count: counts.overdue ?? 0, dot: "rose" },
    { id: "draft",   label: "Draft",   count: counts.draft ?? 0 },
  ];

  // Filter — Partial and Pending both derive from status='pending', split by
  // whether any advances were applied to the invoice.
  const rows = (invoices ?? []).filter((i) => {
    if (tab === "all") return true;
    const hasAdv = Array.isArray(i.adjusted_advances) && i.adjusted_advances.length > 0;
    if (tab === "partial") return i.status === "pending" && hasAdv;
    if (tab === "pending") return i.status === "pending" && !hasAdv;
    return i.status === tab;
  });

  // KPIs
  const outstanding = (invoices ?? [])
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amount, 0);
  const overdueTotal = (invoices ?? [])
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);
  const overdueCount = counts.overdue ?? 0;
  const collectedMTD = (invoices ?? [])
    .filter((i) => {
      if (i.status !== "paid" || !i.paid_date) return false;
      const d = new Date(i.paid_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, i) => s + i.amount, 0);
  const marginMTD = Math.round(collectedMTD * 0.17); // 17% avg estimate
  const paidInvoices = (invoices ?? []).filter((i) => i.status === "paid" && i.paid_date);
  const avgCollection = paidInvoices.length > 0
    ? Math.round(paidInvoices.reduce((s, i) => s + daysBetween(i.invoice_date, i.paid_date!), 0) / paidInvoices.length)
    : 0;

  // Toggle selection
  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Revenue</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Invoices</h1>
          <p className="text-sm text-ink-3 mt-1">All GST invoices · sorted by most recent</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="upload" onClick={() => toast("Export GSTR-1 — coming soon")}>Export GSTR-1</Button>
          <Button icon="refresh" onClick={() => toast("Zoho Books sync — coming soon")}>Push to Zoho</Button>
          <Button variant="primary" icon="plus" onClick={() => toast.info("Generate invoices from accepted+paid quotes at /quotes")}>
            New invoice
          </Button>
        </div>
      </div>

      {/* ── Pending generation — partial OR fully-paid quotes awaiting GST invoice ──
           Legal context: CGST Section 13(2) + Rule 47 — supply trigger for services
           = earlier of invoice OR payment. So aging clock starts from FIRST advance
           receipt, not last payment. 30-day deadline drives bucket thresholds:
             0-15d   = fresh
             16-30d  = approaching deadline (issue soon)
             31-60d  = OVERDUE — legal violation, audit risk
             60+d    = critical — penalty likely
      */}
      {pending && pending.length > 0 && (() => {
        const now = Date.now();
        const buckets = { fresh: [] as any[], warn: [] as any[], urgent: [] as any[], overdue: [] as any[] };
        for (const q of pending) {
          // Legal aging anchor = first advance received (not last payment)
          const anchor = q.first_advance_at ?? q.payment_received_at;
          const days = anchor
            ? Math.floor((now - new Date(anchor).getTime()) / 86400000)
            : 0;
          if (days <= 15)       buckets.fresh.push({ ...q, days });
          else if (days <= 30)  buckets.warn.push({ ...q, days });
          else if (days <= 60)  buckets.urgent.push({ ...q, days });
          else                  buckets.overdue.push({ ...q, days });
        }
        const sumAmt = (arr: any[]) => arr.reduce((s, q) => s + (q.amount ?? 0), 0);
        const totalAmt = sumAmt(pending);

        const togglePending = (id: string) => {
          const next = new Set(pendingSelected);
          if (next.has(id)) next.delete(id); else next.add(id);
          setPendingSelected(next);
        };
        const toggleAllPending = () => {
          if (pendingSelected.size === pending.length) setPendingSelected(new Set());
          else setPendingSelected(new Set(pending.map((q) => q.id)));
        };

        const generateSelected = async () => {
          if (pendingSelected.size === 0) {
            toast.error("Select at least one quote");
            return;
          }
          setGenerating(true);
          let ok = 0, fail = 0;
          for (const id of pendingSelected) {
            try {
              await generateInvoice.mutateAsync(id);
              ok++;
            } catch {
              fail++;
            }
          }
          setGenerating(false);
          setPendingSelected(new Set());
          if (ok > 0) toast.success(`Generated ${ok} invoice${ok === 1 ? "" : "s"}` + (fail ? ` · ${fail} failed` : ""));
          if (fail > 0 && ok === 0) toast.error(`${fail} invoice${fail === 1 ? "" : "s"} failed`);
        };

        return (
          <Card className="mb-6 border-amber/40 bg-amber-soft/30">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2.5">
                <Icon name="receipt" size={18} className="text-amber-ink" />
                <div>
                  <h2 className="font-semibold text-ink">Pending GST invoice generation</h2>
                  <p className="text-xs text-ink-3">
                    {pending.length} quote{pending.length === 1 ? "" : "s"} ·{" "}
                    {pending.filter((q: any) => q.payment_status === "partial").length} partially paid ·{" "}
                    {rupee(totalAmt)} total · invoice mandatory within 30 days of first advance (CGST §13, Rule 47)
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {pendingSelected.size > 0 && (
                  <Button
                    variant="primary"
                    icon="receipt"
                    loading={generating}
                    onClick={generateSelected}
                  >
                    Generate {pendingSelected.size} invoice{pendingSelected.size === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            </div>

            {/* Aging buckets — 30-day GST clock (Rule 47) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <BucketTile label="0–15 days · fresh"      count={buckets.fresh.length}   amount={sumAmt(buckets.fresh)}   tone="emerald" />
              <BucketTile label="16–30 days · issue soon" count={buckets.warn.length}    amount={sumAmt(buckets.warn)}    tone="amber" />
              <BucketTile label="31–60 days · overdue"   count={buckets.urgent.length}  amount={sumAmt(buckets.urgent)}  tone="rose-soft" />
              <BucketTile label="60+ days · audit risk"  count={buckets.overdue.length} amount={sumAmt(buckets.overdue)} tone="rose" />
            </div>

            {/* Table of pending quotes */}
            <div className="rounded-md border border-hairline bg-paper overflow-x-auto">
              <table className="w-full">
                <thead className="bg-paper-2 border-b border-hairline">
                  <tr>
                    <th className="p-2 w-10">
                      <input
                        type="checkbox"
                        checked={pendingSelected.size === pending.length && pending.length > 0}
                        onChange={toggleAllPending}
                        className="w-3.5 h-3.5 accent-amber cursor-pointer"
                        aria-label="Select all pending"
                      />
                    </th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Quote</th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Customer</th>
                    <th className="text-right p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Amount</th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Payment</th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">First advance</th>
                    <th className="text-left p-2 text-[10px] uppercase tracking-wider font-semibold text-ink-3">Aging</th>
                    <th className="w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((q: any) => {
                    // Legal aging anchor — first advance receipt date (Sec 13(2))
                    const anchor = q.first_advance_at ?? q.payment_received_at;
                    const days = anchor
                      ? Math.floor((now - new Date(anchor).getTime()) / 86400000)
                      : 0;
                    const ageKind: "emerald" | "amber" | "rose" =
                      days <= 15 ? "emerald" : days <= 30 ? "amber" : "rose";
                    const isSel = pendingSelected.has(q.id);
                    const isPartial = q.payment_status === "partial";
                    return (
                      <tr
                        key={q.id}
                        className={`border-b border-hairline last:border-0 hover:bg-paper-2/30 ${
                          isSel ? "bg-amber-soft/30" : ""
                        }`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => togglePending(q.id)}
                            className="w-3.5 h-3.5 accent-amber cursor-pointer"
                            aria-label={`Select ${q.id}`}
                          />
                        </td>
                        <td className="p-2">
                          <Link
                            href={`/quotes/${q.id}` as any}
                            className="font-mono text-xs font-semibold text-ink hover:text-amber-ink hover:underline"
                          >
                            {q.id}
                          </Link>
                        </td>
                        <td className="p-2 text-sm">{q.customer_name}</td>
                        <td className="p-2 text-right tabular-nums text-sm font-medium">
                          {rupee(q.amount ?? 0)}
                          {isPartial && q.payment_amount != null && (
                            <div className="text-[10px] text-amber-ink mt-0.5">
                              {rupee(q.payment_amount)} received
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {isPartial ? (
                            <Badge kind="info" dot>Partial</Badge>
                          ) : (
                            <Badge kind="success" dot>Fully paid</Badge>
                          )}
                        </td>
                        <td className="p-2 text-xs text-ink-2">
                          {anchor ? formatDate(anchor) : "—"}
                        </td>
                        <td className="p-2">
                          <Badge kind={ageKind === "rose" ? "danger" : ageKind === "amber" ? "warning" : "success"} dot>
                            {days}d ago
                          </Badge>
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            variant="primary"
                            icon="receipt"
                            loading={generateInvoice.isPending}
                            onClick={() => generateInvoice.mutate(q.id)}
                          >
                            Generate
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* Compact metric strip (replaces the big KPI-card grid) */}
      {!isLoading && invoices && (
        <StatStrip
          className="mb-5"
          items={[
            { label: "Outstanding",    value: rupee(outstanding, { compact: true }), tone: outstanding > 0 ? "rose" : "emerald" },
            { label: "Overdue",        value: rupee(overdueTotal, { compact: true }), tone: overdueCount > 0 ? "rose" : "default" },
            { label: "Collected · MTD",value: rupee(collectedMTD, { compact: true }), tone: "emerald" },
            { label: "Margin · MTD",   value: rupee(marginMTD, { compact: true }) },
            { label: "Avg collection", value: avgCollection > 0 ? `${avgCollection}d` : "—" },
          ]}
        />
      )}

      {/* AI suggestion */}
      {!isLoading && invoices && overdueCount > 0 && (
        <div className="mb-4">
          <GeminiCard
            title="Collection intelligence"
            actions={
              <Button size="sm" variant="primary" icon="phone" onClick={() => toast("Bulk follow-up queued")}>
                Call all overdue
              </Button>
            }
            compact
          >
            <b>{overdueCount} overdue invoice{overdueCount === 1 ? "" : "s"} worth {rupee(overdueTotal, { compact: true })}.</b>{" "}
            Customers with overdue invoices have 2× higher churn risk. Reach out today.
          </GeminiCard>
        </div>
      )}

      {/* Tabs */}
      {!isLoading && invoices && invoices.length > 0 && (
        <div className="mb-3">
          <TabBar value={tab} onChange={setTab} items={tabs} />
        </div>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="alert"
          title="Could not load invoices"
          body={error.message}
          action={<Button icon="refresh" onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <Card flush>
          <table className="w-full">
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
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
      {!isLoading && !error && invoices && invoices.length === 0 && (
        <EmptyState
          icon="receipt"
          title="No invoices yet"
          body="Invoices are generated when a quote is accepted and payment is recorded. Start by creating a quote."
          action={
            <Button asChild variant="primary" icon="file">
              <a href="/quotes/new">Create a quote</a>
            </Button>
          }
        />
      )}

      {/* Filtered empty */}
      {!isLoading && !error && invoices && invoices.length > 0 && rows.length === 0 && (
        <EmptyState
          icon="receipt"
          title={`No ${tab} invoices`}
          body={tab === "overdue" ? "🎉 All clear! No overdue invoices." : `No invoices in "${tab}" status right now.`}
          action={tab !== "all" ? <Button icon="x" onClick={() => setTab("all")}>Show all</Button> : undefined}
          compact
        />
      )}

      {/* Mobile card list — phones only */}
      {!isLoading && !error && rows.length > 0 && (
        <ul className="md:hidden space-y-2 mb-3">
          {rows.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/quotes/${inv.quote_id}` as never}
                className="block bg-paper border border-hairline rounded-lg p-3 active:bg-paper-2/50"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-ink">{inv.id}</p>
                    <p className="text-sm font-medium text-ink mt-0.5 truncate">{inv.customer_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-base tabular-nums text-ink">{rupee(inv.amount)}</p>
                    {inv.net_payable && inv.net_payable !== inv.amount && (
                      <p className="text-[10px] text-ink-3 tabular-nums">Net: {rupee(inv.net_payable)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-hairline/60 text-xs">
                  <span className="text-ink-3">
                    {inv.created_at ? formatDate(inv.created_at) : "—"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      kind={
                        inv.status === "paid"    ? "success" :
                        inv.status === "overdue" ? "danger"  :
                        inv.status === "pending" ? "warning" :
                        inv.status === "void"    ? "muted"   :
                                                   "muted"
                      }
                      size="sm"
                      dot
                    >
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Desktop table */}
      {!isLoading && !error && rows.length > 0 && (
        <Card flush className="hidden md:block">
          <table className="w-full">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="w-10 p-3">
                  <Checkbox
                    checked={selected.size === rows.length && rows.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Invoice #</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Customer</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Date</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Due date</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Amount</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  checked={selected.has(inv.id)}
                  onToggle={() => toggleOne(inv.id)}
                  autoOpen={inv.id === openInvoiceId}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Auto-sync card */}
      {!isLoading && invoices && invoices.length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Auto-Sync Status</div>
              <div className="text-xs text-ink-3 mt-0.5">
                Zoho Books sync · Coming in Phase 2 · Currently manual
              </div>
            </div>
            <Badge kind="warning" dot>Not configured</Badge>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Invoice row
// ============================================================
function InvoiceRow({
  inv,
  checked,
  onToggle,
  autoOpen = false,
}: {
  inv: Invoice;
  checked: boolean;
  onToggle: () => void;
  /** When true (set by `?open=INV-XX` deep link), opens the preview dialog
   *  immediately. Fires once via a ref guard so re-renders don't re-open. */
  autoOpen?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const autoOpenFired = React.useRef(false);

  React.useEffect(() => {
    if (autoOpen && !autoOpenFired.current) {
      autoOpenFired.current = true;
      setPreviewOpen(true);
    }
  }, [autoOpen]);

  return (
    <>
    <tr className="border-b border-hairline last:border-0 hover:bg-paper-2/40">
      <td className="p-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} />
      </td>
      <td className="p-3 font-mono text-xs font-semibold">{inv.id}</td>
      <td className="p-3 text-sm font-medium">{inv.customer_name}</td>
      <td className="p-3 text-sm text-ink-2">{formatDate(inv.invoice_date)}</td>
      <td className="p-3 text-sm text-ink-2">{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
      <td className="p-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="tabular-nums text-sm font-medium">{rupee(inv.amount)}</span>
          {/* Surface net-payable when advances were adjusted at issue time
              (CGST Rule 53). Otherwise the gross alone is misleading — paid
              invoices may have most of the amount cleared via advance receipts. */}
          {inv.net_payable !== null && inv.net_payable < inv.amount && (
            <span className="text-[10px] font-medium tabular-nums leading-tight text-ink-3">
              Net <span className="text-ink-2">{rupee(inv.net_payable)}</span>
              <span className="text-emerald"> · {rupee(inv.amount - inv.net_payable)} adv</span>
            </span>
          )}
        </div>
      </td>
      <td className="p-3">
        {(() => {
          // "Partial" is a derived display state, not a separate DB enum value.
          // An invoice with status='pending' but adjusted_advances applied has
          // already collected some money (the advance receipts), so showing
          // bare "Pending" misleads the user into thinking nothing's been
          // received. Same for status='overdue' with advances applied —
          // "Overdue · Partial" reflects reality.
          const hasAdvancesApplied = Array.isArray(inv.adjusted_advances) && inv.adjusted_advances.length > 0;
          const badge =
              inv.status === "paid"    ? <Badge kind="success" dot>Paid</Badge>
            : inv.status === "pending" ? (hasAdvancesApplied ? <Badge kind="warning" dot>Partial</Badge> : <Badge kind="warning" dot>Pending</Badge>)
            : inv.status === "overdue" ? (hasAdvancesApplied ? <Badge kind="danger" dot>Overdue · Partial · {inv.overdue_days}d</Badge> : <Badge kind="danger" dot>Overdue {inv.overdue_days}d</Badge>)
            : inv.status === "draft"   ? <Badge kind="muted">Draft</Badge>
            : inv.status === "void"    ? <Badge kind="muted">Void</Badge>
            : null;
          // Draft/void have no receipts — badge stays static. Others toggle the
          // payment-receipts accordion on click.
          if (inv.status === "draft" || inv.status === "void") return badge;
          return (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber rounded"
              title="Show payment receipts"
              aria-expanded={expanded}
            >
              {badge}
              <Icon name={expanded ? "chevron_up" : "chevron_down"} size={12} className="text-ink-3" />
            </button>
          );
        })()}
      </td>
      <td className="p-3">
        <div className="flex gap-1">
          {/* View — opens the full GST tax invoice PDF dialog */}
          {inv.status !== "draft" && inv.status !== "void" && (
            <Button size="sm" icon="file" variant="ghost" onClick={() => setPreviewOpen(true)}>
              View
            </Button>
          )}
          {inv.status === "overdue" && (
            <Button size="sm" variant="danger" icon="phone" onClick={() => toast(`Calling ${inv.customer_name}…`)}>
              Call
            </Button>
          )}
          {inv.status === "pending" && (
            <Button size="sm" icon="mail" onClick={() => toast(`Reminder emailed to ${inv.customer_name}`)}>
              Remind
            </Button>
          )}
          {inv.status === "draft" && (
            <Button size="sm" variant="primary" icon="send">Send</Button>
          )}
        </div>
        {previewOpen && (
          <InvoicePreviewContainer
            invoice={inv}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
          />
        )}
      </td>
    </tr>
    {expanded && (
      <tr className="bg-paper-2/30 border-b border-hairline">
        <td colSpan={8} className="px-5 py-3">
          <InvoicePaymentsAccordion inv={inv} />
        </td>
      </tr>
    )}
    </>
  );
}

/**
 * InvoicePreviewContainer — lazily loads the parent quote + advances when the
 * dialog opens, then renders TaxInvoiceDialog. Lives in its own component so
 * the network calls only fire on first "View" click (not for every row).
 */
function InvoicePreviewContainer({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: quote, isLoading: qLoading } = useQuoteByInvoiceId(invoice.id);
  const { data: payments } = usePaymentsByQuote(quote?.id);
  const { data: customer } = useCustomer(invoice.customer_id ?? undefined);
  const { data: me } = useCurrentUser();

  // Derive totals from quote (same math as quote detail page) — falls back to invoice.amount
  const lineItems = quote?.line_items ?? [];
  const subtotal  = quote?.subtotal ?? invoice.amount;
  const discount  = Math.round(subtotal * ((quote?.discount_pct ?? 0) / 100));
  const taxable   = subtotal - discount;
  const taxRate   = quote?.tax_rate ?? 18;
  const tax       = Math.round(taxable * (taxRate / 100));
  const total     = quote?.amount ?? invoice.amount;

  const interState = isInterStateSupply(customer?.state_code, me?.tenantStateCode);

  const receivedPayments = (payments ?? []).filter((p) => p.status === "received");

  if (qLoading || !me) {
    return (
      <div className="text-[10px] text-ink-3 mt-1 italic">Loading invoice…</div>
    );
  }

  return (
    <TaxInvoiceDialog
      open={open}
      onOpenChange={onOpenChange}
      invoice={invoice}
      lineItems={lineItems}
      subtotal={subtotal}
      discountPct={quote?.discount_pct ?? 0}
      discount={discount}
      taxable={taxable}
      taxRate={taxRate}
      tax={tax}
      total={total}
      receivedPayments={receivedPayments}
      interState={interState}
      customerGstin={customer?.gstin}
      customerEmail={customer?.contact_email}
      customerState={customer?.state}
      tenantName={me.tenantName}
      tenantGstin={me.tenantGstin}
      tenantEmail={me.tenantEmail}
      tenantPhone={me.tenantPhone}
      tenantAddress={me.tenantAddress}
      tenantState={me.tenantState}
    />
  );
}

/**
 * InvoicePaymentsAccordion — expands under an invoice row to list the payment
 * receipts (advance receipt vouchers) collected against it. Invoice → parent
 * quote → payments. Clicking a receipt opens the GST receipt-voucher dialog.
 */
function InvoicePaymentsAccordion({ inv }: { inv: Invoice }) {
  const { data: quote } = useQuoteByInvoiceId(inv.id);
  const { data: payments, isLoading } = usePaymentsByQuote(quote?.id);
  // Project invoices have no parent quote — their receipts live in project_payments.
  const { data: projPays, isLoading: projLoading } = useProjectPaymentsByInvoice(inv.id);
  const { data: customer } = useCustomer(inv.customer_id ?? undefined);
  const { data: me } = useCurrentUser();
  const [receiptPayment, setReceiptPayment] = React.useState<Payment | null>(null);

  const received = (payments ?? []).filter((p) => p.status === "received");
  const interState = isInterStateSupply(customer?.state_code, me?.tenantStateCode);

  if (isLoading || projLoading) return <div className="text-xs text-ink-3 italic">Loading receipts…</div>;

  // Project-sale invoice: render its project payments as the receipts.
  if (received.length === 0 && (projPays?.length ?? 0) > 0) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-2">
          Payment receipts ({projPays!.length})
        </div>
        <ul className="space-y-1.5">
          {projPays!.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-paper px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <Icon name="receipt" size={14} className="text-amber-ink shrink-0" />
                <span className="text-xs text-ink capitalize">{p.method ?? "Payment"}{p.reference ? ` · ${p.reference}` : ""}</span>
                {p.bank_txn_id && <span className="text-[10px] text-emerald">· bank-reconciled</span>}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="tabular-nums text-sm font-medium text-ink">{rupee(p.amount)}</span>
                <span className="text-[11px] text-ink-3">{formatDate(p.received_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (received.length === 0) {
    return <div className="text-xs text-ink-3">No payment receipts recorded for this invoice yet.</div>;
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-2">
        Payment receipts ({received.length})
      </div>
      <ul className="space-y-1.5">
        {received.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setReceiptPayment(p)}
              className="w-full flex items-center justify-between gap-3 rounded-md border border-hairline bg-paper px-3 py-2 text-left transition-colors hover:border-amber-soft hover:bg-amber-soft/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              title="Open receipt voucher"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon name="receipt" size={14} className="text-amber-ink shrink-0" />
                <span className="font-mono text-xs text-ink truncate">{p.receipt_voucher_no ?? "Receipt"}</span>
                <span className="text-[11px] text-ink-3 capitalize">· {p.method}</span>
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="tabular-nums text-sm font-medium text-ink">{rupee(p.amount)}</span>
                <span className="text-[11px] text-ink-3">{formatDate(p.received_at)}</span>
                <Icon name="chevron_right" size={12} className="text-ink-3" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {receiptPayment && me && (
        <ReceiptVoucherDialog
          open={!!receiptPayment}
          onOpenChange={(o) => { if (!o) setReceiptPayment(null); }}
          payment={receiptPayment}
          customerName={inv.customer_name}
          customerGstin={customer?.gstin}
          customerEmail={customer?.contact_email}
          customerAddress={customer?.address}
          tenantName={me.tenantName}
          tenantGstin={me.tenantGstin}
          tenantEmail={me.tenantEmail}
          tenantPhone={me.tenantPhone}
          tenantAddress={me.tenantAddress}
          tenantState={me.tenantState}
          interState={interState}
          quoteId={quote?.id}
          gstRate={quote?.tax_rate ?? 18}
        />
      )}
    </div>
  );
}

// ============================================================
// BucketTile — aging bucket summary for pending invoice generation
// ============================================================
function BucketTile({ label, count, amount, tone }: {
  label:  string;
  count:  number;
  amount: number;
  tone:   "emerald" | "amber" | "rose-soft" | "rose";
}) {
  const styles =
    tone === "emerald"   ? "bg-emerald-soft border-emerald/30 text-emerald" :
    tone === "amber"     ? "bg-amber-soft border-amber/30 text-amber-ink" :
    tone === "rose-soft" ? "bg-rose-soft border-rose/30 text-amber-ink" :
                           "bg-rose-soft border-rose/40 text-rose";
  return (
    <div className={`rounded-md border ${styles} p-3`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="font-serif text-xl mt-0.5 tabular-nums">{count}</div>
      <div className="text-[11px] tabular-nums opacity-80 mt-0.5">{rupee(amount)}</div>
    </div>
  );
}

// InvoicesPageInner uses useSearchParams() — Next.js requires that to live
// under a Suspense boundary so static prerender can bail out gracefully.
export default function InvoicesPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-sm text-ink-3">Loading invoices…</div>}>
      <InvoicesPageInner />
    </React.Suspense>
  );
}
