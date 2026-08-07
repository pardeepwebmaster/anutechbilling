/**
 * GST Reports — single-page view of GST output, input, and net liability
 * for the selected period.
 *
 *   Output GST (sales)  : amount of CGST + SGST + IGST collected from
 *                         customers via invoices
 *   Input GST (purchases): amount of CGST + SGST + IGST paid to vendors
 *                         via vendor_bills + expenses
 *   Net liability        : Output − Input. Positive = payable. Negative =
 *                         refundable / carry-forward credit.
 *
 * Two CSV export buttons let Pardeep hand his CA a ready-to-import file
 * for GSTR-1 / GSTR-3B filing on the IRP portal. (Real IRN generation
 * via ClearTax IRP API is a separate P0 task — see LAUNCH_READINESS.md.)
 */
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ────────────────────────────────────────────────────────────────
// Date range helpers — month default (most common GST filing cadence)
// ────────────────────────────────────────────────────────────────

function istToday(): Date {
  return new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
}
function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DateRange { from: string; to: string; label: string }

function thisMonth(): DateRange {
  const t = istToday();
  const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  const last  = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0));
  const label = first.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return { from: yyyymmdd(first), to: yyyymmdd(last), label };
}

function lastMonth(): DateRange {
  const t = istToday();
  const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
  const last  = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
  const label = first.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return { from: yyyymmdd(first), to: yyyymmdd(last), label };
}

function thisQuarter(): DateRange {
  const t = istToday();
  const qStart = Math.floor(t.getUTCMonth() / 3) * 3;
  const first  = new Date(Date.UTC(t.getUTCFullYear(), qStart, 1));
  const last   = new Date(Date.UTC(t.getUTCFullYear(), qStart + 3, 0));
  return { from: yyyymmdd(first), to: yyyymmdd(last), label: `Q${(qStart / 3) + 1} ${t.getUTCFullYear()}` };
}

// ────────────────────────────────────────────────────────────────
// GST aggregation hook
// ────────────────────────────────────────────────────────────────

interface OutputRow {
  invoiceId:    string;
  invoiceDate:  string;
  customerName: string;
  customerGstin: string | null;
  amount:       number;        // GST-inclusive
  taxableValue: number;        // persisted (migration 0116), else reverse-derived
  gst:          number;        // total GST (persisted, else reverse-derived)
  taxRate:      number;        // GST rate %
  interState:   boolean;       // true → IGST; false → CGST + SGST
  docType?:     "invoice" | "credit_note" | "debit_note";  // credit/debit notes net the output tax
}
interface InputRow {
  source:       "bill" | "expense";
  id:           string;
  date:         string;
  vendor:       string;
  vendorGstin:  string | null;
  taxableValue: number;        // pre-GST
  gst:          number;        // CGST + SGST + IGST or gst_paid
  category:     string;
}
interface GstReport {
  outputRows:    OutputRow[];
  inputRows:     InputRow[];
  outputTotal:   number;
  outputGST:     number;
  inputTotal:    number;
  inputGST:      number;
  netLiability:  number;
}

function useGstReport(range: DateRange) {
  return useQuery({
    queryKey: ["accounting", "gst", range],
    queryFn: async (): Promise<GstReport> => {
      const supabase = createClient();

      // ── Output: invoices issued in the period ─────────────────────
      const { data: invoices, error: invErr } = await supabase
        .from("invoices")
        .select("id, amount, invoice_date, customer_name, customer_id, status, taxable_value, tax_amount, tax_rate, inter_state")
        .gte("invoice_date", range.from)
        .lte("invoice_date", range.to)
        .in("status", ["pending", "paid", "overdue"]);
      if (invErr) throw invErr;

      // Credit / debit notes issued in the period — they NET the output tax (a
      // credit note reduces it, a debit note increases it), so GSTR-1/3B is right.
      const [{ data: creditNotes }, { data: debitNotes }] = await Promise.all([
        supabase.from("credit_notes")
          .select("id, credit_date, customer_name, customer_id, amount, taxable_value, tax_amount, tax_rate, inter_state")
          .gte("credit_date", range.from).lte("credit_date", range.to),
        supabase.from("debit_notes")
          .select("id, debit_date, customer_name, customer_id, amount, taxable_value, tax_amount, tax_rate, inter_state")
          .gte("debit_date", range.from).lte("debit_date", range.to),
      ]);

      // Pull GSTIN from customers table (invoices + notes)
      const customerIds = Array.from(new Set([
        ...(invoices ?? []).map((i) => i.customer_id),
        ...(creditNotes ?? []).map((n) => n.customer_id),
        ...(debitNotes ?? []).map((n) => n.customer_id),
      ].filter((x): x is string => !!x)));
      const gstinByCustomerId = new Map<string, string | null>();
      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from("customers")
          .select("id, gstin")
          .in("id", customerIds);
        for (const c of customers ?? []) gstinByCustomerId.set(c.id, c.gstin ?? null);
      }

      const outputRows: OutputRow[] = (invoices ?? []).map((i) => {
        const amount       = i.amount ?? 0;
        const taxRate      = i.tax_rate ?? 18;
        // Prefer the breakdown persisted at issue time (migration 0116); fall
        // back to reverse-deriving at the row's rate for any legacy invoice.
        const taxableValue = i.taxable_value ?? Math.round(amount * 100 / (100 + taxRate));
        const gst          = i.tax_amount ?? (amount - taxableValue);
        return {
          invoiceId:     i.id,
          invoiceDate:   i.invoice_date,
          customerName:  i.customer_name ?? "—",
          customerGstin: i.customer_id ? gstinByCustomerId.get(i.customer_id) ?? null : null,
          amount,
          taxableValue,
          gst,
          taxRate,
          interState:    i.inter_state ?? false,
          docType:       "invoice",
        };
      });

      // Notes as SIGNED output rows — credit note negative, debit note positive.
      for (const n of creditNotes ?? []) {
        outputRows.push({
          invoiceId: n.id, invoiceDate: n.credit_date, customerName: n.customer_name ?? "—",
          customerGstin: n.customer_id ? gstinByCustomerId.get(n.customer_id) ?? null : null,
          amount: -(n.amount ?? 0), taxableValue: -(n.taxable_value ?? 0), gst: -(n.tax_amount ?? 0),
          taxRate: n.tax_rate ?? 18, interState: n.inter_state ?? false, docType: "credit_note",
        });
      }
      for (const n of debitNotes ?? []) {
        outputRows.push({
          invoiceId: n.id, invoiceDate: n.debit_date, customerName: n.customer_name ?? "—",
          customerGstin: n.customer_id ? gstinByCustomerId.get(n.customer_id) ?? null : null,
          amount: n.amount ?? 0, taxableValue: n.taxable_value ?? 0, gst: n.tax_amount ?? 0,
          taxRate: n.tax_rate ?? 18, interState: n.inter_state ?? false, docType: "debit_note",
        });
      }
      outputRows.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

      // ── Input: vendor bills + GST-paying expenses ─────────────────
      const { data: bills } = await supabase
        .from("vendor_bills")
        .select("id, bill_date, vendor_name, vendor_gstin, subtotal, cgst, sgst, igst, total, category")
        .gte("bill_date", range.from)
        .lte("bill_date", range.to);

      const inputRowsBills: InputRow[] = (bills ?? []).map((b) => ({
        source:       "bill",
        id:           b.id,
        date:         b.bill_date,
        vendor:       b.vendor_name,
        vendorGstin:  b.vendor_gstin ?? null,
        taxableValue: b.subtotal ?? 0,
        gst:          (b.cgst ?? 0) + (b.sgst ?? 0) + (b.igst ?? 0),
        category:     b.category ?? "",
      }));

      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, expense_date, vendor_name, amount, gst_paid, category")
        .gte("expense_date", range.from)
        .lte("expense_date", range.to)
        .gt("gst_paid", 0);

      const inputRowsExpenses: InputRow[] = (expenses ?? []).map((e) => ({
        source:       "expense",
        id:           e.id,
        date:         e.expense_date,
        vendor:       e.vendor_name ?? "—",
        vendorGstin:  null,
        taxableValue: (e.amount ?? 0) - (e.gst_paid ?? 0),
        gst:          e.gst_paid ?? 0,
        category:     e.category ?? "Expense",
      }));

      const inputRows = [...inputRowsBills, ...inputRowsExpenses].sort(
        (a, b) => b.date.localeCompare(a.date),
      );

      // ── Totals ─────────────────────────────────────────────────────
      const outputTotal  = outputRows.reduce((s, r) => s + r.taxableValue, 0);
      const outputGST    = outputRows.reduce((s, r) => s + r.gst, 0);
      const inputTotal   = inputRows.reduce((s, r) => s + r.taxableValue, 0);
      const inputGST     = inputRows.reduce((s, r) => s + r.gst, 0);
      const netLiability = outputGST - inputGST;

      return { outputRows, inputRows, outputTotal, outputGST, inputTotal, inputGST, netLiability };
    },
  });
}

// Split total GST into heads by place of supply. Inter-state → all IGST;
// intra-state → CGST + SGST (halves, remainder into SGST so they sum exactly).
function gstSplit(r: { gst: number; interState: boolean }): { cgst: number; sgst: number; igst: number } {
  if (r.interState) return { cgst: 0, sgst: 0, igst: r.gst };
  const cgst = Math.round(r.gst / 2);
  return { cgst, sgst: r.gst - cgst, igst: 0 };
}

// ────────────────────────────────────────────────────────────────
// CSV export helpers
// ────────────────────────────────────────────────────────────────

function csvEscape(s: unknown): string {
  const v = String(s ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

const QUICK_RANGES = [thisMonth, lastMonth, thisQuarter];

export default function GstReportPage() {
  const [range, setRange] = React.useState<DateRange>(thisMonth());
  const { data, isLoading } = useGstReport(range);

  function exportOutput() {
    if (!data) return;
    downloadCSV(
      `gst-output-${range.from}-to-${range.to}.csv`,
      ["Invoice #", "Invoice date", "Customer", "Customer GSTIN", "Place of supply",
       "Taxable value", "Rate %", "CGST", "SGST", "IGST", "Total GST", "Invoice total"],
      data.outputRows.map((r) => {
        const s = gstSplit(r);
        return [
          r.invoiceId, r.invoiceDate, r.customerName, r.customerGstin ?? "",
          r.interState ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)",
          r.taxableValue, r.taxRate, s.cgst, s.sgst, s.igst, r.gst, r.amount,
        ];
      }),
    );
  }

  function exportInput() {
    if (!data) return;
    downloadCSV(
      `gst-input-${range.from}-to-${range.to}.csv`,
      ["Type", "ID", "Date", "Vendor", "Vendor GSTIN", "Category", "Taxable value", "GST claimable"],
      data.inputRows.map((r) => [
        r.source, r.id, r.date, r.vendor, r.vendorGstin ?? "", r.category,
        r.taxableValue, r.gst,
      ]),
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Accounting</p>
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight">GST Reports</h1>
        <p className="text-sm text-ink-3 mt-1">
          Output GST (collected from customers) − Input GST (paid to vendors) = Net liability.
          Hand the CSV exports to your CA for GSTR-1 / GSTR-3B filing.
        </p>
      </div>

      {/* Range picker */}
      <Card className="mb-6 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_RANGES.map((build) => {
              const target = build();
              const active = range.from === target.from && range.to === target.to;
              return (
                <button
                  key={target.label}
                  type="button"
                  onClick={() => setRange(target)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? "border-amber bg-amber-soft text-amber-ink font-semibold"
                      : "border-hairline text-ink-3 hover:text-ink hover:bg-paper-2"
                  }`}
                >
                  {target.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <input
              type="date" value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper"
            />
            <span className="text-xs text-ink-3">to</span>
            <input
              type="date" value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper"
            />
          </div>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <SummaryCard
          label="Output GST (on sales)"
          taxable={data?.outputTotal ?? 0}
          gst={data?.outputGST ?? 0}
          rowCount={data?.outputRows.length ?? 0}
          rowLabel="invoice"
        />
        <SummaryCard
          label="Input GST paid"
          taxable={data?.inputTotal ?? 0}
          gst={data?.inputGST ?? 0}
          rowCount={data?.inputRows.length ?? 0}
          rowLabel="bill/expense"
        />
        <Card className="p-4 md:p-5 border-2 border-amber/30 bg-amber-soft/20">
          <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">
            Net liability
          </div>
          {isLoading ? <Skeleton className="h-8 w-32 mt-2" /> : (
            <>
              <div className={`font-serif text-2xl md:text-3xl ${data && data.netLiability >= 0 ? "text-rose" : "text-emerald"}`}>
                {data ? rupee(data.netLiability) : "—"}
              </div>
              <div className="text-[11px] text-ink-3 mt-1.5 leading-relaxed">
                {data && data.netLiability >= 0
                  ? "Payable to government via GSTR-3B"
                  : "Refundable / carry-forward input tax credit"}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Output GST table */}
      <SectionHeader
        title="Output GST · sales (GSTR-1 source data)"
        count={data?.outputRows.length ?? 0}
        onExport={exportOutput}
        disabled={isLoading || !data || data.outputRows.length === 0}
      />
      {isLoading ? (
        <Skeleton className="h-32 w-full mb-6" />
      ) : !data || data.outputRows.length === 0 ? (
        <Card className="mb-6">
          <EmptyState
            icon="file"
            title="No invoices in this period"
            body="Issue GST invoices in this range and they'll show up here as your output (sales) GST for GSTR-1."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-4 py-3">Invoice #</th>
                  <th className="text-left  px-4 py-3">Date</th>
                  <th className="text-left  px-4 py-3">Customer</th>
                  <th className="text-left  px-4 py-3">GSTIN</th>
                  <th className="text-right px-4 py-3">Taxable value</th>
                  <th className="text-left  px-4 py-3">Head</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {data.outputRows.map((r) => {
                  const s = gstSplit(r);
                  return (
                  <tr key={r.invoiceId} className="hover:bg-paper-2/40">
                    <td className="px-4 py-3 font-mono text-ink-2">{r.invoiceId}</td>
                    <td className="px-4 py-3 text-ink-2">{formatDate(r.invoiceDate)}</td>
                    <td className="px-4 py-3 text-ink">{r.customerName}</td>
                    <td className="px-4 py-3 font-mono text-ink-3 text-xs">{r.customerGstin ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-2">{rupee(r.taxableValue)}</td>
                    <td className="px-4 py-3 text-ink-3 text-xs">
                      {r.interState
                        ? `IGST ${r.taxRate}%`
                        : `CGST ${r.taxRate / 2}% + SGST ${r.taxRate / 2}%`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald">
                      {rupee(r.gst)}
                      <span className="block text-[10px] text-ink-3">
                        {r.interState ? `IGST ${rupee(s.igst)}` : `${rupee(s.cgst)} + ${rupee(s.sgst)}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ink">{rupee(r.amount)}</td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-paper-2/30 border-t-2 border-ink">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-3 font-semibold">
                    Total ({data.outputRows.length})
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink">{rupee(data.outputTotal)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-emerald">{rupee(data.outputGST)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink">{rupee(data.outputTotal + data.outputGST)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Input GST table */}
      <SectionHeader
        title="Input GST · purchases (GSTR-2A reconciliation source)"
        count={data?.inputRows.length ?? 0}
        onExport={exportInput}
        disabled={isLoading || !data || data.inputRows.length === 0}
      />
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data || data.inputRows.length === 0 ? (
        <Card>
          <EmptyState
            icon="receipt"
            title="No GST-bearing bills in this period"
            body="Add your Google CSP / Microsoft / Zoho bills and expenses here so input GST (ITC) shows up for GSTR-2/3B."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-4 py-3">Source</th>
                  <th className="text-left  px-4 py-3">Date</th>
                  <th className="text-left  px-4 py-3">Vendor</th>
                  <th className="text-left  px-4 py-3">GSTIN</th>
                  <th className="text-left  px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Taxable value</th>
                  <th className="text-right px-4 py-3">GST claimable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {data.inputRows.map((r) => (
                  <tr key={`${r.source}-${r.id}`} className="hover:bg-paper-2/40">
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        r.source === "bill" ? "bg-amber-soft text-amber-ink" : "bg-paper-2 text-ink-2"
                      }`}>
                        {r.source === "bill" ? "Bill" : "Expense"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-ink">{r.vendor}</td>
                    <td className="px-4 py-3 font-mono text-ink-3 text-xs">{r.vendorGstin ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-3 text-xs">{r.category}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-2">{rupee(r.taxableValue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald">{rupee(r.gst)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-paper-2/30 border-t-2 border-ink">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-3 font-semibold">
                    Total ({data.inputRows.length})
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink">{rupee(data.inputTotal)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-emerald">{rupee(data.inputGST)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function SectionHeader({
  title, count, onExport, disabled,
}: {
  title: string;
  count: number;
  onExport: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="font-serif text-xl text-ink leading-tight">{title}</h2>
        {count > 0 && (
          <div className="text-[11px] text-ink-3 mt-0.5">{count} {count === 1 ? "row" : "rows"}</div>
        )}
      </div>
      <Button variant="default" size="sm" onClick={onExport} disabled={disabled}>
        <Icon name="download" size={14} className="mr-1.5" />
        Export CSV
      </Button>
    </div>
  );
}

function SummaryCard({
  label, taxable, gst, rowCount, rowLabel,
}: {
  label: string;
  taxable: number;
  gst: number;
  rowCount: number;
  rowLabel: string;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">{label}</div>
      <div className="font-serif text-2xl md:text-3xl text-ink leading-tight mb-2">{rupee(gst)}</div>
      <div className="text-[11px] text-ink-3 leading-relaxed">
        on {rupee(taxable)} taxable value · {rowCount} {rowLabel}{rowCount === 1 ? "" : "s"}
      </div>
    </Card>
  );
}
