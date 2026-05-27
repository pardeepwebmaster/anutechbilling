/**
 * Expenses — operating expenses (non-COGS).
 *
 * Hosting, salaries, software, office, marketing, etc. These hit the
 * P&L below the gross-margin line. Any GST paid on these bills is
 * input tax credit and rolls up into the GST input report.
 */
"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FAB } from "@/components/ui/fab";
import { rupee, formatDate } from "@/lib/utils";
import {
  useExpenses,
  useExpensesTotals,
  useDeleteExpense,
} from "@/lib/queries/expenses";
import { AddExpenseDialog } from "@/components/features/accounting/add-expense-dialog";

function thisMonthRange(): { from: string; to: string } {
  const now    = new Date();
  const ist    = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const yyyy   = ist.getUTCFullYear();
  const mm     = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const today  = String(ist.getUTCDate()).padStart(2, "0");
  return { from: `${yyyy}-${mm}-01`, to: `${yyyy}-${mm}-${today}` };
}

export default function ExpensesPage() {
  const [range, setRange]     = React.useState(thisMonthRange());
  const [catFilter, setCatFilter] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  const q       = useExpenses({ from: range.from, to: range.to, category: catFilter || undefined });
  const totalsQ = useExpensesTotals(range);
  const del     = useDeleteExpense();

  const rows      = q.data ?? [];
  const isLoading = q.isLoading;
  const totals    = totalsQ.data;

  // Build category list from totals.byCategory keys for the filter dropdown.
  const categoryOptions = totals ? Object.keys(totals.byCategory).sort() : [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Expenses</h1>
          <p className="text-sm text-ink-3 mt-1">
            Operating spend — hosting, salaries, software, office, marketing. These sit below the gross-margin line in your P&L.
          </p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          className="hidden md:inline-flex"
          onClick={() => setAddOpen(true)}
        >
          Add Expense
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KPI label="Entries (this month)" value={totals ? String(totals.count) : "—"} />
        <KPI label="Total spend"          value={totals ? rupee(totals.amount) : "—"} tone="rose" />
        <KPI label="Input GST (claimable)" value={totals ? rupee(totals.gstPaid) : "—"} tone="emerald" />
        <KPI label="Top category"
             value={totals && categoryOptions.length > 0
               ? Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1])[0][0]
               : "—"} />
      </div>

      {/* Filter strip */}
      <Card className="mb-5 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-ink-3 font-semibold uppercase tracking-wide">From</label>
          <input type="date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper" />
          <label className="text-xs text-ink-3 font-semibold uppercase tracking-wide">To</label>
          <input type="date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper" />
          <select value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper">
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="ml-auto text-xs text-ink-3">
            Showing {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </div>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="py-2">
          <EmptyState
            icon="rupee"
            title="No expenses in this range"
            body="Track your operating expenses so the P&L shows real net profit, not just gross margin."
            action={<Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add your first expense</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-4 py-3">Date</th>
                  <th className="text-left  px-4 py-3">Category</th>
                  <th className="text-left  px-4 py-3">Vendor / payee</th>
                  <th className="text-left  px-4 py-3">Description</th>
                  <th className="text-left  px-4 py-3">Method</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-paper-2/40">
                    <td className="px-4 py-3 text-ink-2">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3 text-ink">{e.category}</td>
                    <td className="px-4 py-3 text-ink-2">{e.vendor_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-3 truncate max-w-[280px]">{e.description ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-3 text-xs">{e.payment_method ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-emerald font-mono">{e.gst_paid > 0 ? rupee(e.gst_paid) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink font-mono">{rupee(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <IconButton
                        icon="trash"
                        aria-label="Delete expense"
                        onClick={() => {
                          if (confirm(`Delete this expense?`)) del.mutate(e.id);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-2.5">
            {rows.map((e) => (
              <li key={e.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-ink leading-tight">{e.category}</div>
                    <div className="font-serif text-xl text-ink leading-none">{rupee(e.amount)}</div>
                  </div>
                  <div className="text-[11px] text-ink-3 mb-1.5">
                    {formatDate(e.expense_date)} · {e.payment_method ?? "—"}
                  </div>
                  {e.vendor_name && <div className="text-xs text-ink-2 mb-1">{e.vendor_name}</div>}
                  {e.description && <div className="text-xs text-ink-3 mb-2">{e.description}</div>}
                  <div className="flex items-center justify-between">
                    {e.gst_paid > 0 && (
                      <span className="text-[11px] text-emerald">+{rupee(e.gst_paid)} input GST</span>
                    )}
                    <IconButton
                      icon="trash"
                      aria-label="Delete expense"
                      className="ml-auto"
                      onClick={() => {
                        if (confirm(`Delete this expense?`)) del.mutate(e.id);
                      }}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <FAB icon="plus" label="Expense" onClick={() => setAddOpen(true)} ariaLabel="Add Expense" />
      {addOpen && <AddExpenseDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function KPI({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const colorClass = tone === "emerald" ? "text-emerald"
                   : tone === "rose"    ? "text-rose"
                   : "text-ink";
  return (
    <Card className="p-3 md:p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">{label}</div>
      <div className={`font-serif text-xl md:text-2xl ${colorClass} leading-tight`}>{value}</div>
    </Card>
  );
}
