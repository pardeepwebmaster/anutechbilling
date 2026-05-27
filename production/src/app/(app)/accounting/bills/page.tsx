/**
 * Vendor Bills — bills RECEIVED from suppliers (Google CSP, MS Partner,
 * Zoho Partner). Source of COGS for the P&L report + input tax credit
 * for GST input reports.
 *
 * Layout
 *   ┌ KPI strip ─────────────────────────────────────────┐
 *   │  This month bills │ Unpaid │ Input GST │ Categories│
 *   ├ Filter strip ──────────────────────────────────────┤
 *   │  Date range · Category filter · Status filter      │
 *   ├ Bills table / mobile cards ────────────────────────┤
 *   │  Vendor · Bill # · Date · Total · Status · Actions │
 *   └────────────────────────────────────────────────────┘
 */
"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FAB } from "@/components/ui/fab";
import { rupee, formatDate } from "@/lib/utils";
import {
  useVendorBills,
  useVendorBillsTotals,
  useDeleteVendorBill,
} from "@/lib/queries/vendor-bills";
import { AddVendorBillDialog } from "@/components/features/accounting/add-vendor-bill-dialog";

/** First day of current month → today, in YYYY-MM-DD (IST-safe). */
function thisMonthRange(): { from: string; to: string } {
  const now    = new Date();
  const ist    = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const yyyy   = ist.getUTCFullYear();
  const mm     = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const today  = String(ist.getUTCDate()).padStart(2, "0");
  return { from: `${yyyy}-${mm}-01`, to: `${yyyy}-${mm}-${today}` };
}

const STATUS_COLOR: Record<string, "rose" | "emerald" | "amber" | "slate"> = {
  unpaid:  "rose",
  paid:    "emerald",
  partial: "amber",
};

export default function VendorBillsPage() {
  const [range, setRange]   = React.useState(thisMonthRange());
  const [statusFilter, setStatusFilter] = React.useState<"" | "unpaid" | "paid" | "partial">("");
  const [addOpen, setAddOpen] = React.useState(false);

  const billsQ  = useVendorBills({
    from:   range.from,
    to:     range.to,
    status: statusFilter || undefined,
  });
  const totalsQ = useVendorBillsTotals(range);
  const del     = useDeleteVendorBill();

  const bills    = billsQ.data ?? [];
  const isLoading = billsQ.isLoading;
  const totals   = totalsQ.data;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Vendor Bills</h1>
          <p className="text-sm text-ink-3 mt-1">
            Bills you receive from Google CSP, Microsoft Partner, Zoho Partner — your COGS source.
          </p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          className="hidden md:inline-flex"
          onClick={() => setAddOpen(true)}
        >
          Add Bill
        </Button>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KPI label="Bills (this month)" value={totals ? String(totals.count) : "—"} />
        <KPI label="Total amount"       value={totals ? rupee(totals.total) : "—"} />
        <KPI label="Outstanding"        value={totals ? rupee(totals.outstanding) : "—"}
             tone={totals && totals.outstanding > 0 ? "rose" : undefined} />
        <KPI label="Input GST (claimable)" value={totals ? rupee(totals.inputGst) : "—"} tone="emerald" />
      </div>

      {/* ── Filter strip ────────────────────────────────────────── */}
      <Card className="mb-5 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-ink-3 font-semibold uppercase tracking-wide">From</label>
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper"
          />
          <label className="text-xs text-ink-3 font-semibold uppercase tracking-wide">To</label>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper"
          >
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
          <div className="ml-auto text-xs text-ink-3">
            Showing {bills.length} {bills.length === 1 ? "bill" : "bills"}
          </div>
        </div>
      </Card>

      {/* ── List ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : bills.length === 0 ? (
        <Card className="py-2">
          <EmptyState
            icon="receipt"
            title="No bills in this range"
            body="Add your Google CSP / Microsoft Partner / Zoho bills here so COGS and input GST show up on your P&L and GST reports."
            action={<Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add your first bill</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-4 py-3">Vendor</th>
                  <th className="text-left  px-4 py-3">Category</th>
                  <th className="text-left  px-4 py-3">Bill #</th>
                  <th className="text-left  px-4 py-3">Bill date</th>
                  <th className="text-right px-4 py-3">Pre-GST</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left  px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {bills.map((b) => {
                  const gst = (b.cgst ?? 0) + (b.sgst ?? 0) + (b.igst ?? 0);
                  return (
                    <tr key={b.id} className="hover:bg-paper-2/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink inline-flex items-center gap-2 flex-wrap">
                          {b.vendor_name}
                          {b.source_tenant_invoice_id && (
                            <Badge color="indigo" title="Auto-imported from your distributor — created when they invoiced you">
                              From distributor
                            </Badge>
                          )}
                        </div>
                        {b.vendor_gstin && (
                          <div className="text-[11px] text-ink-3 font-mono">{b.vendor_gstin}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-2">{b.category}</td>
                      <td className="px-4 py-3 font-mono text-ink-2">{b.bill_no || "—"}</td>
                      <td className="px-4 py-3 text-ink-2">{formatDate(b.bill_date)}</td>
                      <td className="px-4 py-3 text-right text-ink-2 font-mono">{rupee(b.subtotal)}</td>
                      <td className="px-4 py-3 text-right text-emerald font-mono">{gst > 0 ? rupee(gst) : "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-ink font-mono">{rupee(b.total)}</td>
                      <td className="px-4 py-3">
                        <Badge color={STATUS_COLOR[b.status] ?? "slate"}>{b.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <IconButton
                          icon="trash"
                          aria-label="Delete bill"
                          onClick={() => {
                            if (confirm(`Delete bill ${b.bill_no || b.id}?`)) del.mutate(b.id);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile card list */}
          <ul className="md:hidden space-y-2.5">
            {bills.map((b) => {
              const gst = (b.cgst ?? 0) + (b.sgst ?? 0) + (b.igst ?? 0);
              return (
                <li key={b.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-medium text-ink leading-tight">{b.vendor_name}</div>
                      <Badge color={STATUS_COLOR[b.status] ?? "slate"}>{b.status}</Badge>
                    </div>
                    <div className="text-[11px] text-ink-3 font-mono mb-2">
                      {b.bill_no || "—"} · {formatDate(b.bill_date)}
                    </div>
                    <div className="text-xs text-ink-3 mb-2">{b.category}</div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="font-serif text-xl text-ink leading-none">{rupee(b.total)}</div>
                        {gst > 0 && (
                          <div className="text-[11px] text-emerald mt-1">+{rupee(gst)} input GST</div>
                        )}
                      </div>
                      <IconButton
                        icon="trash"
                        aria-label="Delete bill"
                        onClick={() => {
                          if (confirm(`Delete bill ${b.bill_no || b.id}?`)) del.mutate(b.id);
                        }}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Mobile FAB */}
      <FAB icon="plus" label="Bill" onClick={() => setAddOpen(true)} ariaLabel="Add Bill" />

      {/* Add dialog */}
      {addOpen && <AddVendorBillDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ─── Tiny KPI card ────────────────────────────────────────────────────
function KPI({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose" | "amber";
}) {
  const colorClass = tone === "emerald" ? "text-emerald"
                   : tone === "rose"    ? "text-rose"
                   : tone === "amber"   ? "text-amber-ink"
                   : "text-ink";
  return (
    <Card className="p-3 md:p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">{label}</div>
      <div className={`font-serif text-xl md:text-2xl ${colorClass} leading-tight`}>{value}</div>
    </Card>
  );
}
