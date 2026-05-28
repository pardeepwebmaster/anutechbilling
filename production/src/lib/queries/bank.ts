/**
 * Bank accounts + transactions — TanStack Query hooks.
 *
 * Two entities:
 *   • bank_accounts    — operator's bank accounts (HDFC / ICICI / SBI etc.)
 *   • bank_transactions — individual ledger entries, either typed manually,
 *     imported from a CSV statement, or (future) auto-fetched via API.
 *
 * Reconciliation pattern: each bank_transaction can be linked to ONE source
 * entity in the rest of the system via (matched_to_type, matched_to_id).
 * Today supported types: 'payment' (customer paid us), 'expense' (we paid a
 * vendor), 'vendor_bill', 'transfer' (between our own accounts), 'manual'
 * (operator says it's reconciled, no internal match).
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

export type BankAccountRow = {
  id:                   string;
  tenant_id:            string;
  name:                 string;
  bank_name:            string;
  account_number_last4: string;
  ifsc:                 string;
  account_type:         "current" | "savings" | "overdraft" | "fixed_deposit" | "other";
  opening_balance:      number;
  opening_balance_date: string;
  is_active:            boolean;
  notes:                string | null;
  created_at:           string;
  updated_at:           string;
  // computed (joined via RPC on read)
  current_balance?:     number;
};

export type BankTransactionRow = {
  id:               string;
  tenant_id:        string;
  bank_account_id:  string;
  txn_date:         string;
  description:      string;
  debit:            number;
  credit:           number;
  balance_after:    number | null;
  reference:        string | null;
  source:           "manual" | "csv_upload" | "api_fetch";
  matched_to_type:  "payment" | "expense" | "vendor_bill" | "transfer" | "manual" | null;
  matched_to_id:    string | null;
  matched_at:       string | null;
  matched_by:       string | null;
  match_confidence: "exact" | "high" | "low" | "manual" | null;
  imported_at:      string;
  created_at:       string;
  updated_at:       string;
};

export type BankAccountInsert = Omit<
  BankAccountRow,
  "id" | "tenant_id" | "created_at" | "updated_at" | "current_balance"
>;

export type BankTransactionInsert = Omit<
  BankTransactionRow,
  | "id"
  | "tenant_id"
  | "imported_at"
  | "created_at"
  | "updated_at"
  | "matched_to_type"
  | "matched_to_id"
  | "matched_at"
  | "matched_by"
  | "match_confidence"
>;

// ─── Bank accounts ─────────────────────────────────────────────────────────

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async (): Promise<BankAccountRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Compute current_balance for each account via the RPC. We could lazy-
      // load this per-card but the count is small (a handful per tenant)
      // and the RPC is fast (single aggregation per account).
      const accounts = (data ?? []) as BankAccountRow[];
      const withBalances = await Promise.all(
        accounts.map(async (acc) => {
          const { data: bal } = await supabase.rpc("bank_account_current_balance", {
            p_account_id: acc.id,
          });
          return { ...acc, current_balance: (bal as number | null) ?? acc.opening_balance };
        }),
      );
      return withBalances;
    },
    staleTime: 60_000,
  });
}

export function useBankAccount(id: string | null | undefined) {
  return useQuery({
    queryKey: ["bank_accounts", id],
    enabled:  Boolean(id),
    queryFn: async (): Promise<BankAccountRow | null> => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      const { data: bal } = await supabase.rpc("bank_account_current_balance", {
        p_account_id: id,
      });
      return { ...(data as BankAccountRow), current_balance: (bal as number | null) ?? data.opening_balance };
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<BankAccountInsert, "is_active">) => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Not authenticated");
      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", authData.user.id)
        .single();
      if (meErr) throw meErr;
      const { data, error } = await supabase
        .from("bank_accounts")
        .insert({ ...input, tenant_id: me!.tenant_id })
        .select()
        .single();
      if (error) throw error;
      return data as BankAccountRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast.success("Bank account added");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not add bank account");
    },
  });
}

// ─── Bank transactions ─────────────────────────────────────────────────────

export function useBankTransactions(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ["bank_transactions", accountId],
    enabled:  Boolean(accountId),
    queryFn: async (): Promise<BankTransactionRow[]> => {
      if (!accountId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("bank_account_id", accountId)
        .order("txn_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BankTransactionRow[];
    },
    staleTime: 30_000,
  });
}

/**
 * Bulk insert bank transactions from a parsed CSV/Excel upload.
 * Skips rows where both debit and credit are zero. Auto-assigns
 * source='csv_upload' for the whole batch.
 */
export function useImportBankTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      accountId: string;
      rows: Array<Omit<BankTransactionInsert, "bank_account_id" | "source">>;
    }) => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Not authenticated");
      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", authData.user.id)
        .single();
      if (meErr) throw meErr;

      const validRows = input.rows
        .filter((r) => (r.debit ?? 0) > 0 || (r.credit ?? 0) > 0)
        .map((r) => ({
          ...r,
          tenant_id:       me!.tenant_id,
          bank_account_id: input.accountId,
          source:          "csv_upload" as const,
        }));

      if (validRows.length === 0) {
        throw new Error("No valid transactions to import (each row needs debit or credit > 0)");
      }

      const { data, error } = await supabase
        .from("bank_transactions")
        .insert(validRows)
        .select("id");
      if (error) throw error;
      return { inserted: data?.length ?? 0 };
    },
    onSuccess: ({ inserted }, vars) => {
      qc.invalidateQueries({ queryKey: ["bank_transactions", vars.accountId] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });   // current_balance changed
      toast.success(`${inserted} transaction${inserted === 1 ? "" : "s"} imported`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Import failed");
    },
  });
}

/**
 * Reconcile a bank transaction against an internal record (payment / expense
 * / vendor_bill / transfer). Setting matched_to_type='manual' marks it as
 * "reconciled but no internal match" — useful for owner's-own transfers,
 * bank charges, etc.
 *
 * Pass matched_to_type=null to UN-reconcile.
 */
export function useReconcileTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transactionId: string;
      matchedToType: "payment" | "expense" | "vendor_bill" | "transfer" | "manual" | null;
      matchedToId:   string | null;
      confidence?:   "exact" | "high" | "low" | "manual";
    }) => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const patch = input.matchedToType
        ? {
            matched_to_type:  input.matchedToType,
            matched_to_id:    input.matchedToId,
            matched_at:       new Date().toISOString(),
            matched_by:       authData?.user?.id ?? null,
            match_confidence: input.confidence ?? "manual",
          }
        : {
            matched_to_type:  null,
            matched_to_id:    null,
            matched_at:       null,
            matched_by:       null,
            match_confidence: null,
          };
      const { data, error } = await supabase
        .from("bank_transactions")
        .update(patch)
        .eq("id", input.transactionId)
        .select()
        .single();
      if (error) throw error;
      return data as BankTransactionRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["bank_transactions", row.bank_account_id] });
      toast.success(row.matched_to_type ? "Reconciled" : "Un-reconciled");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Reconcile failed");
    },
  });
}

/**
 * Server-side match-suggestion helper. Returns nearest payments/expenses by
 * amount + date proximity. Used in the reconcile picker so the operator
 * sees "Match to TechVista ₹5,21,088 (exact)" without typing.
 */
export type MatchSuggestion = {
  match_type:       "payment" | "expense";
  match_id:         string;
  match_label:      string;
  match_amount:     number;
  match_date:       string;
  match_confidence: "exact" | "high" | "low";
};

export function useSuggestMatches(transactionId: string | null | undefined) {
  return useQuery({
    queryKey: ["bank_txn_matches", transactionId],
    enabled:  Boolean(transactionId),
    queryFn: async (): Promise<MatchSuggestion[]> => {
      if (!transactionId) return [];
      const supabase = createClient();
      const { data, error } = await supabase.rpc("suggest_bank_transaction_matches", {
        p_bank_txn_id: transactionId,
      });
      if (error) throw error;
      return (data ?? []) as MatchSuggestion[];
    },
    staleTime: 60_000,
  });
}
