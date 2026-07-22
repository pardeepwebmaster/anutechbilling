/**
 * PnLDrilldownDialog — click a P&L line to see the transactions behind it.
 *
 * The P&L Report shows summary rows (Revenue, COGS, Operating expenses). Each
 * of those is the SUM of real records in the selected period. This dialog is
 * the "show me the rows" popup: pick a kind + the same date range and it lists
 * every underlying transaction, with a total that reconciles to the P&L line.
 *
 *   revenue  → invoices issued in the period (pending / paid / overdue)
 *   cogs     → vendor bills categorised COGS-* (shown at pre-GST subtotal)
 *   expenses → operating expenses in the period
 *
 * Read-only. No money is written here — it's a lens onto existing data.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { rupee, formatDate } from "@/lib/utils";

export type PnLDrillKind = "revenue" | "cogs" | "expenses";

interface DrillRow {
  id:      string;
  date:    string;
  primary: string;   // main label (customer / vendor / category)
  sub:     string;   // secondary (invoice no + status / category / vendor·method)
  amount:  number;   // the value that feeds the P&L line
}

interface Props {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  kind:         PnLDrillKind | null;
  range:        { from: string; to: string };
}

const META: Record<PnLDrillKind, { title: string; desc: string; href: string; hrefLabel: string; tone: "ink" | "rose" }> = {
  revenue: {
    title: "Revenue — invoices in this period",
    desc:  "Every invoice issued in the range (pending, paid or overdue). Accrual basis — counted on invoice date, not payment date.",
    href:  "/invoices",
    hrefLabel: "Open Invoices",
    tone:  "ink",
  },
  cogs: {
    title: "COGS — vendor bills in this period",
    desc:  "Vendor bills categorised as cost-of-goods (Google / Microsoft / Zoho wholesale). Shown at pre-GST cost — the amount that reduces gross margin.",
    href:  "/accounting/bills",
    hrefLabel: "Open Vendor Bills",
    tone:  "rose",
  },
  expenses: {
    title: "Operating expenses — this period",
    desc:  "All operating expenses booked in the range (rent, salaries, software, marketing…). GST paid is shown separately in the GST snapshot.",
    href:  "/accounting/expenses",
    hrefLabel: "Open Expenses",
    tone:  "rose",
  },
};

function useDrilldown(kind: PnLDrillKind | null, range: { from: string; to: string }, enabled: boolean) {
  return useQuery({
    queryKey: ["accounting", "pnl-drill", kind, range],
    enabled:  enabled && !!kind,
    queryFn: async (): Promise<DrillRow[]> => {
      const supabase = createClient();

      if (kind === "revenue") {
        const { data, error } = await supabase
          .from("invoices")
          .select("id, customer_name, invoice_date, amount, status")
          .gte("invoice_date", range.from)
          .lte("invoice_date", range.to)
          .in("status", ["pending", "paid", "overdue"])
          .order("invoice_date", { ascending: false });
        if (error) throw error;
        return (data ?? []).map((i) => ({
          id:      i.id,
          date:    i.invoice_date,
          primary: i.customer_name || "Customer",
          sub:     `${i.id} · ${i.status}`,
          amount:  i.amount ?? 0,
        }));
      }

      if (kind === "cogs") {
        const { data, error } = await supabase
          .from("vendor_bills")
          .select("id, vendor_name, bill_no, bill_date, subtotal, category")
          .gte("bill_date", range.from)
          .lte("bill_date", range.to)
          .like("category", "COGS-%")
          .order("bill_date", { ascending: false });
        if (error) throw error;
        return (data ?? []).map((b) => ({
          id:      b.id,
          date:    b.bill_date,
          primary: b.vendor_name || "Vendor",
          sub:     [b.category?.replace(/^COGS-/, ""), b.bill_no].filter(Boolean).join(" · "),
          amount:  b.subtotal ?? 0,
        }));
      }

      // expenses
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, vendor_name, description, expense_date, amount, payment_method")
        .gte("expense_date", range.from)
        .lte("expense_date", range.to)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id:      e.id,
        date:    e.expense_date,
        primary: e.category || "Expense",
        sub:     [e.vendor_name || e.description, e.payment_method].filter(Boolean).join(" · ") || "—",
        amount:  e.amount ?? 0,
      }));
    },
  });
}

export function PnLDrilldownDialog({ open, onOpenChange, kind, range }: Props) {
  const { data: rows, isLoading } = useDrilldown(kind, range, open);
  const meta = kind ? META[kind] : null;
  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0);
  const amountColor = meta?.tone === "rose" ? "text-rose" : "text-ink";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 gap-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-hairline">
          <DialogTitle className="text-lg">{meta?.title ?? "Details"}</DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed">
            {meta?.desc}
          </DialogDescription>
          <p className="text-[11px] text-ink-3 mt-1">
            {range.from} to {range.to}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !rows || rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-hairline bg-paper-2/20 px-4 py-8 text-center">
              <Icon name="inbox" size={20} className="text-ink-3 mx-auto mb-1" />
              <p className="text-sm text-ink-2">No transactions in this period</p>
              <p className="text-[11px] text-ink-3 mt-1">
                Nothing recorded between {range.from} and {range.to}.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{r.primary}</p>
                    <p className="text-[11px] text-ink-3 truncate">{r.sub}</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className={`font-mono text-sm ${amountColor}`}>{rupee(r.amount)}</p>
                    <p className="text-[11px] text-ink-3">{formatDate(r.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {rows && rows.length > 0 && (
          <div className="px-5 py-3 border-t border-hairline flex items-center justify-between gap-3 bg-paper-2/30">
            <span className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">
              Total · {rows.length} {rows.length === 1 ? "item" : "items"}
            </span>
            <span className={`font-mono text-base font-semibold ${amountColor}`}>{rupee(total)}</span>
          </div>
        )}

        {meta && (
          <div className="px-5 py-3 border-t border-hairline">
            <Link
              href={meta.href as never}
              className="text-xs text-amber-ink hover:underline inline-flex items-center gap-1"
            >
              {meta.hrefLabel} <Icon name="arrow_right" size={12} />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
