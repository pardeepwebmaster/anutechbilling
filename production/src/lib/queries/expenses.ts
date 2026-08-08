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
// Marketing = broad strategy (market research, PR, branding, CRM software,
// website upkeep, email-automation tools). Advertising = paid outreach only
// (social/TV ads, billboards, PPC). Kept as separate categories so the P&L can
// tell brand-building spend apart from direct paid campaigns.
export const EXPENSE_CATEGORIES = [
  "Hosting",
  "Software",
  "Salaries",
  "Office Rent",
  "Marketing",
  "Advertising",
  "Business Promotion",
  "Travel",
  "Professional Services",
  "Bank Charges",
  "Internet & Phone",
  "Utilities",
  "Office Supplies",
  "Equipment",
  "Repairs & Maintenance",
  "Insurance",
  "Other",
] as const;

/**
 * Guess an expense category from the free-text "what was this for?" note.
 * First keyword match wins (more specific patterns first). Returns null when
 * nothing matches — so we never override with a wrong guess. The operator can
 * always change the picked category. 'Salaries' is intentionally never guessed
 * (those belong in Payroll).
 */
// Keywords are English + Hinglish/Hindi (Roman) — operators here write notes
// like "client ke pass jane ke liye" (travel) or "team ke liye khana" (food).
const CATEGORY_KEYWORDS: [RegExp, (typeof EXPENSE_CATEGORIES)[number]][] = [
  [/\b(rent|lease|kiraya|kiraaya)\b/i, "Office Rent"],
  [/\b(cab|taxi|uber|ola|rapido|flight|air ?fare|train|irctc|hotel|stay|travel|petrol|diesel|fuel|toll|parking|mileage|conveyance|jaana|jaane|jana|jane|aana|aane|safar|yatra|gaadi|gadi|rickshaw|riksha|\bbus\b|\btel\b)\b/i, "Travel"],
  [/\b(internet|wi-?fi|broadband|phone|mobile|airtel|jio|vodafone|\bvi\b|bsnl|recharge|data ?pack|\bsim\b|net ?pack)\b/i, "Internet & Phone"],
  [/(electric|bijli|power ?bill|water ?bill|paani|utilit|gas ?bill|generator|\bdg\b)/i, "Utilities"],
  [/\b(hosting|domain|server|cloud|aws|gcp|azure|vps|cpanel|\bssl\b|render|vercel|netlify)\b/i, "Hosting"],
  [/\b(software|saas|subscription|licen[cs]e|zoom|slack|figma|adobe|github|notion|canva|chatgpt|openai|anthropic|claude|gemini)\b/i, "Software"],
  [/\b(stationery|stationary|paper|kagaz|kaagaz|printer ?ink|toner|cartridge|\bpen\b|register|copy|folder|envelope|supplies)\b/i, "Office Supplies"],
  [/\b(laptop|computer|desktop|monitor|keyboard|mouse|furniture|chair|kursi|\btable\b|hardware|equipment|air ?condition|\bac\b|ups\b)\b/i, "Equipment"],
  [/\b(repair|maintenance|\bamc\b|servicing|service ?charge|marammat|mistri)\b/i, "Repairs & Maintenance"],
  [/\b(insurance|premium|policy|mediclaim|bima)\b/i, "Insurance"],
  [/\b(advertis|\bads?\b|\bppc\b|google ?ads|facebook ?ads|meta ?ads|billboard|hoarding|banner ?ad|vigyapan)\b/i, "Advertising"],
  [/\b(marketing|branding|\bseo\b|campaign|newsletter|email ?tool|\bcrm\b)\b/i, "Marketing"],
  [/\b(lunch|dinner|breakfast|food|snack|tea|coffee|chai|chaay|khana|khaana|khane|nashta|naashta|mithai|bhojan|restaurant|swiggy|zomato|catering|refreshment|sweets?|gift|party)\b/i, "Business Promotion"],
  [/\b(\bca\b|chartered|accountant|audit|lawyer|legal|advocate|vakil|consultant|professional ?fee|retainer|notary)\b/i, "Professional Services"],
  [/\b(bank ?charge|bank ?fee|processing ?fee|neft|rtgs|imps ?charge|transaction ?fee|convenience ?fee)\b/i, "Bank Charges"],
];

export function suggestCategory(text: string): (typeof EXPENSE_CATEGORIES)[number] | null {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return null;
  for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(t)) return cat;
  return null;
}

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
      // Newest first: by bill date, then most-recently-added (created_at) so a
      // freshly-entered expense always lands at the top even on a shared date.
      let q = supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (from)     q = q.gte("expense_date", from);
      if (to)       q = q.lte("expense_date", to);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

/** Expenses not yet reconciled to a bank line — candidates for a split match. */
export function useUnreconciledExpenses() {
  return useQuery({
    queryKey: ["expenses", "unreconciled"],
    queryFn: async (): Promise<Expense[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .is("reconciled_txn_id", null)
        // 'statutory' expenses (e.g. employer-ESI accrual) are settled via the
        // statutory payable, never matched to a single bank line — keep them out
        // of the reconcile candidate list. (.or keeps NULL payment_method rows,
        // which a bare .neq would silently drop.)
        .or("payment_method.is.null,payment_method.neq.statutory")
        .order("expense_date", { ascending: false });
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
// Duplicate detection — catch the same bill entered twice.
// ────────────────────────────────────────────────────────────────

/** Minimal shape used to detect a duplicate bill. */
export type DupCandidate = {
  vendorId?: string | null;
  vendorName?: string | null;
  billNo?: string | null;
  billDate?: string | null;
  amountInr?: number | null;   // ₹ — only known once currency is converted
  category?: string | null;    // same bill no. + DIFFERENT category = a split, not a dup
};

/** Recent expenses (light columns) to check a new bill against. */
export function useExpenseDupList() {
  return useQuery({
    queryKey: ["expenses", "dupList"],
    queryFn: async (): Promise<Pick<Expense, "id" | "vendor_id" | "vendor_name" | "bill_no" | "expense_date" | "amount" | "currency" | "category">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("id, vendor_id, vendor_name, bill_no, expense_date, amount, currency, category")
        .order("expense_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as never;
    },
    staleTime: 30_000,
  });
}

/**
 * Pure duplicate finder. A match is:
 *   - same vendor AND same bill number (the natural key), OR
 *   - (no bill number) same vendor + same date + same ₹ amount.
 * `selfId` excludes the row being edited. Returns the first match, else null.
 */
export function findDuplicateExpense(
  c: DupCandidate,
  list: { id: string; vendor_id: string | null; vendor_name: string | null; bill_no: string | null; expense_date: string; amount: number; category?: string | null }[],
  selfId?: string,
): { id: string; expense_date: string; amount: number; bill_no: string | null } | null {
  const name = (c.vendorName ?? "").trim().toLowerCase();
  const billNo = (c.billNo ?? "").trim().toLowerCase();
  for (const e of list) {
    if (selfId && e.id === selfId) continue;
    const sameVendor =
      (!!c.vendorId && e.vendor_id === c.vendorId) ||
      (!!name && (e.vendor_name ?? "").trim().toLowerCase() === name);
    if (!sameVendor) continue;
    if (billNo && (e.bill_no ?? "").trim().toLowerCase() === billNo) {
      // Same vendor + same bill no. → a real duplicate ONLY if the category also
      // matches. A different category under the same invoice is a legitimate
      // split (multi-head purchase), not a duplicate. If no category was given
      // (e.g. the pre-confirm review), fall back to a bill-no match.
      if (!c.category || (e.category ?? "") === c.category) return e;
      continue;
    }
    if (!billNo && !e.bill_no && c.billDate && e.expense_date === c.billDate &&
        c.amountInr != null && Math.abs(e.amount - c.amountInr) <= 1) return e;
  }
  return null;
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
    // `pettyCashAccountId` (optional): when a cash expense is paid out of a
    // petty-cash account, we also drop a matching DEBIT on that account so its
    // "cash in hand" balance stays live. Not part of the expenses table.
    mutationFn: async (
      input: Omit<ExpenseInsert, "id" | "tenant_id"> & { pettyCashAccountId?: string | null },
    ) => {
      const { pettyCashAccountId, ...expenseInput } = input;
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
          ...expenseInput,
          id:        newExpenseId(),
          tenant_id: me.tenant_id,
        })
        .select()
        .single();
      if (error) throw error;
      const expense = data as Expense;

      // Petty-cash out-flow — best-effort. If it fails the expense is still
      // saved; the operator can add the cash movement manually.
      if (pettyCashAccountId && expense.amount > 0) {
        const { error: txnErr } = await supabase.from("bank_transactions").insert({
          tenant_id:        me.tenant_id,
          bank_account_id:  pettyCashAccountId,
          txn_date:         expense.expense_date,
          description:      `Petty cash: ${expense.category}${expense.vendor_name ? ` · ${expense.vendor_name}` : ""}`,
          debit:            expense.amount,
          credit:           0,
          source:           "manual",
          matched_to_type:  "expense",
          matched_to_id:    expense.id,
          match_confidence: "manual",
        });
        if (txnErr) console.error("[create-expense] petty-cash debit failed (expense still saved):", txnErr);
      }

      return expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
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
