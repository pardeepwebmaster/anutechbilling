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
  type Expense,
} from "@/lib/queries/expenses";
import { AddExpenseDialog } from "@/components/features/accounting/add-expense-dialog";
import { useSalaryPayments } from "@/lib/queries/payroll";
import { useConfirm } from "@/components/providers/confirm-provider";

type DateRange = { from: string; to: string };

/** Reconcile tag shown next to a Salaries expense's category. Salary expenses
 *  reflect their salary's paid-status (which supports PARTIAL payments); every
 *  other expense uses its own reconciled_txn_id. */
type SalMini = { paid_status: "unpaid" | "partial" | "paid"; paid_amount: number; net: number };
function reconcileTag(e: Expense, sal?: SalMini):
  { tone: "emerald" | "amber"; label: string; title?: string } | null {
  if (e.category === "Salaries" && sal) {
    if (sal.paid_status === "paid") return { tone: "emerald", label: "✓ Reconciled" };
    if (sal.paid_status === "partial") {
      return {
        tone: "amber",
        label: `◐ Partial · ${rupee(sal.paid_amount)}/${rupee(sal.net)}`,
        title: `Partly reconciled — ${rupee(sal.net - sal.paid_amount)} still owed. Reconcile another bank line in Banking to clear it.`,
      };
    }
    return null; // unpaid salary — no tag
  }
  if (e.reconciled_txn_id) return { tone: "emerald", label: "✓ Reconciled" };
  return null;
}
function ReconcileTag({ tone, label, title }: { tone: "emerald" | "amber"; label: string; title?: string }) {
  const cls = tone === "emerald" ? "bg-emerald/10 text-emerald" : "bg-amber-soft text-amber-ink";
  return (
    <span title={title} className={`ml-2 inline-flex items-center gap-0.5 rounded-full ${cls} px-1.5 py-0.5 text-[10px] font-medium align-middle`}>
      {label}
    </span>
  );
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

function istNow() {
  const n = new Date();
  const ist = new Date(n.getTime() + 5.5 * 60 * 60 * 1000);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth() + 1, d: ist.getUTCDate() };
}


// Quick presets (Indian FY = Apr 1 → Mar 31).
const RANGE_PRESETS: { id: string; label: string; range: () => DateRange }[] = [
  { id: "month",    label: "This month",   range: () => { const { y, m } = istNow(); return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) }; } },
  { id: "quarter",  label: "This quarter", range: () => { const { y, m } = istNow(); const qs = Math.floor((m - 1) / 3) * 3 + 1; return { from: iso(y, qs, 1), to: iso(y, qs + 2, lastDay(y, qs + 2)) }; } },
  { id: "half",     label: "Half-year",    range: () => {
      // FY half-years (Indian FY Apr–Mar): H1 = Apr–Sep, H2 = Oct–Mar.
      const { y, m } = istNow();
      if (m >= 4 && m <= 9) return { from: iso(y, 4, 1),  to: iso(y, 9, 30) };       // H1
      if (m >= 10)          return { from: iso(y, 10, 1), to: iso(y + 1, 3, 31) };   // H2 (Oct–Dec side)
      return { from: iso(y - 1, 10, 1), to: iso(y, 3, 31) };                          // H2 (Jan–Mar side)
    } },
  { id: "fy",       label: "This FY",      range: () => { const { y, m } = istNow(); const fs = m >= 4 ? y : y - 1; return { from: iso(fs, 4, 1), to: iso(fs + 1, 3, 31) }; } },
  { id: "prevfy",   label: "Previous FY",  range: () => { const { y, m } = istNow(); const fs = m >= 4 ? y : y - 1; return { from: iso(fs - 1, 4, 1), to: iso(fs, 3, 31) }; } },
];

export default function ExpensesPage() {
  // Default to the "This month" preset itself (not 1st→today) so the chip shows
  // as selected out of the box.
  const [range, setRange]     = React.useState(RANGE_PRESETS[0].range());
  const [catFilter, setCatFilter] = React.useState("");
  const [payeeFilter, setPayeeFilter] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Expense | null>(null);

  const q       = useExpenses({ from: range.from, to: range.to, category: catFilter || undefined });
  const totalsQ = useExpensesTotals(range);
  const del     = useDeleteExpense();
  const salariesQ = useSalaryPayments();
  const confirm = useConfirm();

  // expense_id → its salary payment (for the partial/paid reconcile tag).
  const salByExpense = React.useMemo(
    () => new Map((salariesQ.data ?? []).filter((s) => s.expense_id).map((s) => [s.expense_id as string, s])),
    [salariesQ.data],
  );

  const allRows   = q.data ?? [];
  const isLoading = q.isLoading;
  const totals    = totalsQ.data;

  // Build category list from totals.byCategory keys for the filter dropdown.
  const categoryOptions = totals ? Object.keys(totals.byCategory).sort() : [];

  // Distinct vendors/payees in the current range → drives the payee filter, so
  // you can see everything paid to one supplier (e.g. Anthropic) with its total
  // + input GST in one place.
  const payeeOptions = React.useMemo(
    () => Array.from(new Set(allRows.map((e) => (e.vendor_name ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allRows],
  );

  // Rows after the client-side payee filter (category is applied in the query).
  const rows = payeeFilter ? allRows.filter((e) => (e.vendor_name ?? "") === payeeFilter) : allRows;

  // Totals for whatever is currently filtered — count, amount, and input GST.
  const filtered = React.useMemo(() => rows.reduce(
    (acc, e) => { acc.amount += e.amount ?? 0; acc.gst += e.gst_paid ?? 0; return acc; },
    { amount: 0, gst: 0 },
  ), [rows]);
  const isFiltered = Boolean(payeeFilter || catFilter);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Purchases</p>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Expenses</h1>
          <p className="text-sm text-ink-3 mt-1">
            Operating spend — rent, salaries, stationery, your own software, marketing. These sit below the gross-margin line in your P&L.
            <span className="block mt-0.5 text-[12px] text-ink-3">Bills for products you <b>resell</b> (Google/Microsoft/Zoho) go in <b>Vendor Bills</b> instead — those are COGS.</span>
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

      {/* How it works — payment handling, so nobody double-enters the pay-out */}
      <Card className="mb-5 p-3 md:p-4 border-amber/40 bg-amber-soft/25">
        <p className="text-[13px] text-ink-2 leading-relaxed">
          <b className="text-ink">How it works:</b> record the cost <b>once</b> here — it hits your P&amp;L. When you actually pay the vendor, that money-out is <b>reconciled in Banking</b> against this expense — don&apos;t enter it again as a second expense. Paying by <b>cash</b>? pick a petty-cash account and it&apos;s deducted from cash-in-hand automatically.
        </p>
      </Card>

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
        {/* Quick range presets */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {RANGE_PRESETS.map((p) => {
            const r = p.range();
            const active = range.from === r.from && range.to === r.to;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  active
                    ? "bg-amber text-white border-amber"
                    : "bg-paper border-hairline text-ink-2 hover:border-hairline-strong"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
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
          <select value={payeeFilter}
            onChange={(e) => setPayeeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper max-w-[200px]">
            <option value="">All vendors / payees</option>
            {payeeOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {isFiltered && (
            <button type="button" onClick={() => { setCatFilter(""); setPayeeFilter(""); }}
              className="text-xs text-amber-ink hover:underline">Clear</button>
          )}
          <div className="ml-auto text-xs text-ink-3">
            Showing {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </div>
        </div>
        {/* Filtered summary — total paid + input GST for the current filter
            (e.g. everything paid to one vendor). */}
        {isFiltered && rows.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md bg-paper-2/50 px-3 py-2 text-sm">
            <span className="text-ink-3">
              {payeeFilter || catFilter}{payeeFilter && catFilter ? ` · ${catFilter}` : ""}
            </span>
            <span className="text-ink-2"><b className="text-ink font-mono tabular-nums">{rupee(filtered.amount)}</b> paid</span>
            <span className="text-emerald"><b className="font-mono tabular-nums">{rupee(filtered.gst)}</b> input GST</span>
            <span className="text-ink-3">{rows.length} {rows.length === 1 ? "payment" : "payments"}</span>
          </div>
        )}
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
          {/* Desktop table — scrolls horizontally rather than clipping so the
              Amount / Actions columns are never cut off on narrower laptops. */}
          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-3 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left  px-3 py-3">Category</th>
                  <th className="text-left  px-3 py-3">Vendor / payee</th>
                  <th className="text-left  px-3 py-3">Description</th>
                  <th className="text-left  px-3 py-3">Method</th>
                  <th className="text-right px-3 py-3">GST</th>
                  <th className="text-right px-3 py-3">Amount</th>
                  <th className="text-right px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-paper-2/40">
                    <td className="px-3 py-3 text-ink-2 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                    <td className="px-3 py-3 text-ink whitespace-nowrap">
                      {e.category}
                      {(() => { const t = reconcileTag(e, salByExpense.get(e.id)); return t ? <ReconcileTag {...t} /> : null; })()}
                    </td>
                    <td className="px-3 py-3 text-ink-2 whitespace-nowrap">{e.vendor_name ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-3">
                      <span className="block max-w-[280px] truncate" title={e.description ?? undefined}>{e.description ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-ink-3 text-xs whitespace-nowrap">{e.payment_method ?? "—"}</td>
                    <td className="px-3 py-3 text-right text-emerald font-mono whitespace-nowrap">{e.gst_paid > 0 ? rupee(e.gst_paid) : "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-ink font-mono whitespace-nowrap">{rupee(e.amount)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <IconButton
                        icon="edit"
                        aria-label="Edit expense"
                        onClick={() => setEditing(e)}
                      />
                      <IconButton
                        icon="trash"
                        aria-label="Delete expense"
                        className="ml-1"
                        onClick={async () => {
                          if (await confirm({ title: `Delete this expense?`, danger: true, confirmLabel: "Delete" })) del.mutate(e.id);
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
                    <div className="font-medium text-ink leading-tight">
                      {e.category}
                      {(() => { const t = reconcileTag(e, salByExpense.get(e.id)); return t ? <ReconcileTag {...t} /> : null; })()}
                    </div>
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
                    <div className="ml-auto flex items-center gap-1">
                      <IconButton icon="edit" aria-label="Edit expense" onClick={() => setEditing(e)} />
                      <IconButton
                        icon="trash"
                        aria-label="Delete expense"
                        onClick={async () => {
                          if (await confirm({ title: `Delete this expense?`, danger: true, confirmLabel: "Delete" })) del.mutate(e.id);
                        }}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <FAB icon="plus" label="Expense" onClick={() => setAddOpen(true)} ariaLabel="Add Expense" />
      {addOpen && <AddExpenseDialog onClose={() => setAddOpen(false)} />}
      {editing && <AddExpenseDialog expense={editing} onClose={() => setEditing(null)} />}
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
