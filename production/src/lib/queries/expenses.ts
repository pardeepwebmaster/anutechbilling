/**
 * Expenses — Phase 1 accounting queries.
 *
 * Operating expenses (NON-COGS) — hosting, salaries, software, office, etc.
 * Used on /accounting/expenses, /accounting/pnl, /accounting/gst/input.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Database, ExpenseRow } from "@/lib/supabase/database.types";

type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

export type Expense = ExpenseRow;

/** Common Indian SME expense categories — surface as a Select default. */
export const EXPENSE_CATEGORIES = [
  "Hosting",
  "Software",
  "Salaries",
  "Office Rent",
  "Marketing",
  "Travel",
  "Professional Services",
  "Bank Charges",
  "Internet & Phone",
  "Utilities",
  "Other",
] as const;

export const PAYMENT_METHODS = [
  "bank_transfer",
  "upi",
  "card",
  "cheque",
  "cash",
] as const;

// ────────────────────────────────────────────────────────────────
// Reads
// ────────────────────────────────────────────────────────────────

export function useExpenses(opts?: {
  from?: string;
  to?:   string;
  category?: string;
}) {
  const { from, to, category } = opts ?? {};
  return useQuery({
    queryKey: ["expenses", { from, to, category }],
    queryFn: async (): Promise<Expense[]> => {
      const supabase = createClient();
      let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (from)     q = q.gte("expense_date", from);
      if (to)       q = q.lte("expense_date", to);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

export function useExpensesTotals(opts: { from: string; to: string }) {
  return useQuery({
    queryKey: ["expenses", "totals", opts],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, gst_paid, category")
        .gte("expense_date", opts.from)
        .lte("expense_date", opts.to);
      if (error) throw error;

      const rows = data ?? [];
      const totals = {
        count:    rows.length,
        amount:   0,
        gstPaid:  0,
        byCategory: {} as Record<string, number>,
      };
      for (const r of rows) {
        totals.amount  += r.amount   ?? 0;
        totals.gstPaid += r.gst_paid ?? 0;
        const cat = r.category ?? "Other";
        totals.byCategory[cat] = (totals.byCategory[cat] ?? 0) + (r.amount ?? 0);
      }
      return totals;
    },
  });
}

// ────────────────────────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────────────────────────

function newExpenseId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand  = Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `EXP-${stamp}-${rand}`;
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ExpenseInsert, "id" | "tenant_id">) => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Not authenticated");

      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", authData.user.id)
        .single();
      if (meErr || !me) throw new Error("User not linked to a tenant");

      const { data, error } = await supabase
        .from("expenses")
        .insert({
          ...input,
          id:        newExpenseId(),
          tenant_id: me.tenant_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense added");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ExpenseUpdate }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense updated");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}
