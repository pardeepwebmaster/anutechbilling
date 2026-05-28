/**
 * Account Aggregator (AA) — TanStack Query hooks.
 *
 * Wraps the /api/aa/setu/* endpoints. The flow:
 *   1. initiateConsent({ bank_account_id, vua }) → returns { redirectUrl }
 *   2. User opens the URL, approves on phone (or simulate-approval page in mock mode)
 *   3. Setu calls /api/aa/setu/callback with the consent_handle_id → we mark active
 *   4. fetchNow({ connection_id }) → pulls FI Data, inserts bank_transactions
 *
 * The connection row is the single source of truth for status + last_fetch_at.
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type BankAaConnection = {
  id:                  string;
  tenant_id:           string;
  bank_account_id:     string;
  provider:            "setu" | "finvu" | "onemoney";
  vua:                 string;
  consent_handle_id:   string | null;
  consent_id:          string | null;
  linked_account_ref:  string | null;
  status:              "initiated" | "pending_approval" | "active" | "expired" | "revoked" | "rejected" | "error";
  status_reason:       string | null;
  consent_expires_at:  string | null;
  fetch_window_from:   string | null;
  fetch_window_to:     string | null;
  last_fetch_at:       string | null;
  last_fetch_status:   string | null;
  last_fetch_count:    number;
  next_fetch_after:    string | null;
  notes:               string | null;
  created_at:          string;
  updated_at:          string;
};

export function useBankAaConnection(bankAccountId: string | null | undefined) {
  return useQuery({
    queryKey: ["bank_aa_connection", bankAccountId],
    enabled:  Boolean(bankAccountId),
    queryFn: async (): Promise<BankAaConnection | null> => {
      if (!bankAccountId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bank_aa_connections")
        .select("*")
        .eq("bank_account_id", bankAccountId)
        .in("status", ["initiated", "pending_approval", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as BankAaConnection | null;
    },
    staleTime: 30_000,
  });
}

export function useInitiateAaConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bank_account_id:   string;
      vua:               string;
      fetch_window_days: number;            // e.g. 180 → past 180 days of statements
    }): Promise<{ redirectUrl: string; connectionId: string }> => {
      const res = await fetch("/api/aa/setu/consent/init", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Consent initiate failed: ${await res.text()}`);
      return (await res.json()) as { redirectUrl: string; connectionId: string };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bank_aa_connection", vars.bank_account_id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not start AA connection");
    },
  });
}

export function useFetchAaNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { connection_id: string }): Promise<{ inserted: number }> => {
      const res = await fetch(`/api/aa/setu/fetch/${input.connection_id}`, { method: "POST" });
      if (!res.ok) throw new Error(`Fetch failed: ${await res.text()}`);
      return (await res.json()) as { inserted: number };
    },
    onSuccess: ({ inserted }, _vars) => {
      qc.invalidateQueries({ queryKey: ["bank_aa_connection"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast.success(`${inserted} new transaction${inserted === 1 ? "" : "s"} synced from bank`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    },
  });
}
