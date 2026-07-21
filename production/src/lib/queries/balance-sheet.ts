/**
 * Balance Sheet data.
 *
 * Two parts:
 *   1. useBalanceSheetAuto()  — figures ResellerOS can compute from its own
 *      records (cash & bank, trade receivables, TDS receivable, trade payables,
 *      GST payable). All "as of now" — current live balances.
 *   2. Manual line CRUD       — operator-entered items the app doesn't track
 *      (fixed assets, loans, owner's capital, drawings, deposits…), under
 *      Assets / Liabilities / Equity.
 *
 * The page combines both and derives Equity = Total Assets − Total Liabilities
 * so the sheet always balances (retained earnings is the plug — standard for a
 * single-entry books-lite setup).
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { BalanceSheetSection } from "@/lib/supabase/database.types";

export type BalanceSheetItem = {
  id:         string;
  section:    BalanceSheetSection;
  label:      string;
  amount:     number;
  sort_order: number;
  notes:      string | null;
};

export interface BalanceSheetAuto {
  cashAndBank:     number;   // sum of all bank + cash account balances
  receivables:     number;   // customers' unpaid balances (subscriptions outstanding)
  tdsReceivable:   number;   // pending TDS credits from customers
  employeeLoans:   number;   // outstanding loans/advances to employees (an asset)
  fixedAssets:     number;   // cost of assets bought on EMI (an asset)
  payables:        number;   // unpaid vendor bills (total − paid)
  salaryDuesPayable: number; // withheld TDS/PF/ESI not yet paid to govt (a liability)
  emiLoansPayable: number;   // outstanding EMI/asset loans (a liability)
  gstPayable:      number;   // net GST this FY (output − input); may be negative (credit)
  fyLabel:         string;   // e.g. "FY 2026-27" for the GST caveat
}

// ── Auto figures from app records ───────────────────────────────────────────
export function useBalanceSheetAuto() {
  return useQuery({
    queryKey: ["balance-sheet", "auto"],
    queryFn: async (): Promise<BalanceSheetAuto> => {
      const supabase = createClient();

      // Cash & bank — sum current_balance across every account (bank + cash).
      const { data: accounts, error: accErr } = await supabase
        .from("bank_accounts")
        .select("id, opening_balance");
      if (accErr) throw accErr;
      let cashAndBank = 0;
      for (const a of accounts ?? []) {
        const { data: bal } = await supabase.rpc("bank_account_current_balance", { p_account_id: a.id });
        cashAndBank += (bal as number | null) ?? a.opening_balance ?? 0;
      }

      // Trade receivables — customers who still owe a balance.
      const { data: subs, error: subErr } = await supabase
        .from("subscriptions")
        .select("outstanding_amount, written_off_at")
        .gt("outstanding_amount", 0)
        .is("written_off_at", null);
      if (subErr) throw subErr;
      const receivables = (subs ?? []).reduce((s, r) => s + (r.outstanding_amount ?? 0), 0);

      // TDS receivable — credits not yet claimed / written off.
      const { data: tds, error: tdsErr } = await supabase
        .from("tds_receivable")
        .select("tds_amount, status")
        .in("status", ["pending_cert", "cert_received", "verified_26as"]);
      if (tdsErr) throw tdsErr;
      const tdsReceivable = (tds ?? []).reduce((s, r) => s + (r.tds_amount ?? 0), 0);

      // Employee loans / advances outstanding — principal − repayments, an asset.
      const { data: loans, error: loanErr } = await supabase
        .from("employee_loans")
        .select("id, principal");
      if (loanErr) throw loanErr;
      const { data: loanReps, error: loanRepErr } = await supabase
        .from("employee_loan_repayments")
        .select("amount");
      if (loanRepErr) throw loanRepErr;
      const loanPrincipal = (loans ?? []).reduce((s, l) => s + (l.principal ?? 0), 0);
      const loanRepaid    = (loanReps ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const employeeLoans = Math.max(0, loanPrincipal - loanRepaid);

      // Assets bought on EMI: total cost is a fixed asset; financed-minus-
      // principal-paid is a loan liability.
      const { data: emiP, error: emiErr } = await supabase.from("emi_purchases").select("total_cost, financed");
      if (emiErr) throw emiErr;
      const { data: emiPay, error: emiPayErr } = await supabase.from("emi_payments").select("principal_part");
      if (emiPayErr) throw emiPayErr;
      const fixedAssets     = (emiP ?? []).reduce((s, r) => s + (r.total_cost ?? 0), 0);
      const emiFinanced     = (emiP ?? []).reduce((s, r) => s + (r.financed ?? 0), 0);
      const emiPrincipalPaid = (emiPay ?? []).reduce((s, r) => s + (r.principal_part ?? 0), 0);
      const emiLoansPayable = Math.max(0, emiFinanced - emiPrincipalPaid);

      // Trade payables — vendor bills with an unpaid balance.
      const { data: bills, error: bErr } = await supabase
        .from("vendor_bills")
        .select("total, paid_amount, status")
        .neq("status", "paid");
      if (bErr) throw bErr;
      const payables = (bills ?? []).reduce((s, b) => s + Math.max(0, (b.total ?? 0) - (b.paid_amount ?? 0)), 0);

      // Salary dues payable — withheld TDS/PF/ESI not yet remitted to govt.
      const { data: salRows, error: salErr } = await supabase.from("salary_payments").select("tds, pf, esi");
      if (salErr) throw salErr;
      const withheld = (salRows ?? []).reduce((s, r) => s + (r.tds ?? 0) + (r.pf ?? 0) + (r.esi ?? 0), 0);
      const { data: duesPaid, error: dpErr } = await supabase.from("statutory_dues_payments").select("amount");
      if (dpErr) throw dpErr;
      const duesPaidTotal = (duesPaid ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const salaryDuesPayable = Math.max(0, withheld - duesPaidTotal);

      // GST payable — net for the current fiscal year (output − input). This is
      // an estimate before any GSTR filing/payment; the page footnotes it.
      const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const fyStartYear = now.getUTCMonth() < 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
      const fyFrom = `${fyStartYear}-04-01`;
      const fyTo   = now.toISOString().slice(0, 10);
      const fyLabel = `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;

      const { data: invoices } = await supabase
        .from("invoices")
        .select("amount, invoice_date, status")
        .gte("invoice_date", fyFrom).lte("invoice_date", fyTo)
        .in("status", ["pending", "paid", "overdue"]);
      const outputGST = Math.round((invoices ?? []).reduce((s, i) => s + (i.amount ?? 0) * 18 / 118, 0));

      const { data: fyBills } = await supabase
        .from("vendor_bills")
        .select("cgst, sgst, igst, bill_date")
        .gte("bill_date", fyFrom).lte("bill_date", fyTo);
      const billsGst = (fyBills ?? []).reduce((s, b) => s + (b.cgst ?? 0) + (b.sgst ?? 0) + (b.igst ?? 0), 0);

      const { data: fyExp } = await supabase
        .from("expenses")
        .select("gst_paid, expense_date")
        .gte("expense_date", fyFrom).lte("expense_date", fyTo);
      const expGst = (fyExp ?? []).reduce((s, e) => s + (e.gst_paid ?? 0), 0);

      const gstPayable = outputGST - billsGst - expGst;

      return { cashAndBank, receivables, tdsReceivable, employeeLoans, fixedAssets, payables, salaryDuesPayable, emiLoansPayable, gstPayable, fyLabel };
    },
    staleTime: 30_000,
  });
}

// ── Manual lines ────────────────────────────────────────────────────────────
export function useBalanceSheetItems() {
  return useQuery({
    queryKey: ["balance-sheet", "items"],
    queryFn: async (): Promise<BalanceSheetItem[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("balance_sheet_items")
        .select("id, section, label, amount, sort_order, notes")
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BalanceSheetItem[];
    },
  });
}

export function useCreateBalanceSheetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { section: BalanceSheetSection; label: string; amount: number; notes?: string | null }) => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Not authenticated");
      const { data: me, error: meErr } = await supabase
        .from("users").select("tenant_id").eq("id", authData.user.id).single();
      if (meErr || !me) throw new Error("User not linked to a tenant");

      const { error } = await supabase.from("balance_sheet_items").insert({
        tenant_id: me.tenant_id,
        section:   input.section,
        label:     input.label,
        amount:    input.amount,
        notes:     input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance-sheet", "items"] });
      toast.success("Line added");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useUpdateBalanceSheetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; label: string; amount: number }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("balance_sheet_items")
        .update({ label: input.label, amount: input.amount })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance-sheet", "items"] });
      toast.success("Line updated");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useDeleteBalanceSheetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("balance_sheet_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance-sheet", "items"] });
      toast.success("Line removed");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}
