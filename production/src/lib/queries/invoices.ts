/**
 * Invoices — TanStack Query hooks.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Invoice } from "@/lib/supabase/database.types";

export function useInvoices(filter?: { status?: Invoice["status"] | "all" }) {
  return useQuery({
    queryKey: ["invoices", filter?.status ?? "all"],
    queryFn: async (): Promise<Invoice[]> => {
      const supabase = createClient();
      let q = supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false });
      if (filter?.status && filter.status !== "all") {
        q = q.eq("status", filter.status);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCustomerInvoices(customerId: string | undefined) {
  return useQuery({
    queryKey: ["invoices", "customer", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<Invoice[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId!)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ============================================================
// Quotes awaiting GST invoice — partial OR fully-paid, no invoice yet
//
// Legal context: CGST Section 13(2) — supply trigger for services =
// earlier of invoice OR payment. So as soon as a partial advance is
// received, the 30-day invoicing clock starts (Rule 47). We MUST allow
// invoice generation in 'partial' state, not just 'received'.
//
// Aging is computed from the FIRST payment (advance receipt) on the
// quote — not the last — because that's when the legal clock started.
// ============================================================
export function useQuotesAwaitingInvoice() {
  return useQuery({
    queryKey: ["quotes", "awaiting-invoice"],
    queryFn: async () => {
      const supabase = createClient();

      // Both partial AND fully-paid quotes need invoicing within 30 days of first advance
      const { data: quotes, error } = await supabase
        .from("quotes")
        .select(
          "id, customer_id, customer_name, amount, payment_amount, payment_received_at, payment_method, lead_id, payment_status",
        )
        .in("payment_status", ["partial", "received"])
        .is("invoice_id", null);
      if (error) throw error;
      if (!quotes || quotes.length === 0) return [];

      // Fetch the earliest received payment per quote — legal aging anchor
      const quoteIds = quotes.map((q) => q.id);
      const { data: payments, error: pErr } = await supabase
        .from("payments")
        .select("quote_id, received_at")
        .in("quote_id", quoteIds)
        .eq("status", "received")
        .order("received_at", { ascending: true });
      if (pErr) throw pErr;

      const firstAdvanceByQuote = new Map<string, string>();
      for (const p of payments ?? []) {
        if (!firstAdvanceByQuote.has(p.quote_id)) {
          firstAdvanceByQuote.set(p.quote_id, p.received_at);
        }
      }

      // Decorate each quote with its first_advance_at; sort by oldest first (most urgent)
      return quotes
        .map((q) => ({
          ...q,
          first_advance_at: firstAdvanceByQuote.get(q.id) ?? q.payment_received_at ?? null,
        }))
        .sort((a, b) => {
          if (!a.first_advance_at) return 1;
          if (!b.first_advance_at) return -1;
          return a.first_advance_at.localeCompare(b.first_advance_at);
        });
    },
  });
}

// ============================================================
// Generate GST invoice from a quote — with advance adjustment
//
// Legal flow (CGST Section 31 + Rule 53):
//   1. Allocate next sequential invoice number via RPC (race-safe)
//   2. Snapshot all received payments → adjusted_advances jsonb (frozen)
//   3. net_payable = amount - sum(advances), floor 0
//   4. status determined by net_payable: 0 → "paid", >0 → "pending"
//   5. Quote moves to payment_status='invoiced' (terminal state from quote POV)
//
// Idempotency:
//   - Quotes already have invoice_id? Refuse — one quote, one invoice.
//   - Future: split-invoicing support would loosen this (separate task).
// ============================================================
export function useGenerateInvoice() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const supabase = createClient();

      // ── 1. Load quote + verify no existing invoice ──
      const { data: quote, error: qErr } = await supabase
        .from("quotes")
        .select(
          "id, tenant_id, customer_id, customer_name, amount, payment_method, payment_reference, invoice_id",
        )
        .eq("id", quoteId)
        .single();
      if (qErr || !quote) throw qErr ?? new Error("Quote not found");
      if (quote.invoice_id) {
        throw new Error(`Invoice ${quote.invoice_id} already exists for this quote`);
      }

      // ── 2. Compute advance adjustment snapshot from payments ──
      const { data: adjData, error: adjErr } = await supabase
        .rpc("compute_advance_adjustment", { p_quote_id: quoteId });
      if (adjErr) throw adjErr;

      // RPC returns an array — single row tuple. Defensive defaults if empty.
      const adj = adjData?.[0] ?? { advances: [], total_paid: 0, first_at: null };
      const advances      = adj.advances ?? [];
      const totalAdvances = adj.total_paid ?? 0;
      const firstAdvanceAt = adj.first_at;

      const grossAmount = quote.amount ?? 0;
      const netPayable  = Math.max(0, grossAmount - totalAdvances);

      // ── 3. Allocate next sequential invoice number (atomic, GST-compliant) ──
      const { data: invoiceId, error: seqErr } = await supabase
        .rpc("next_document_number", { p_doc_type: "invoice" });
      if (seqErr || !invoiceId) throw seqErr ?? new Error("Failed to issue invoice number");

      const today   = new Date().toISOString().slice(0, 10);
      const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      // ── 4. Decide status — "paid" only if no balance left, else "pending" ──
      // For partial-payment customers, invoice goes out as pending — they owe net_payable.
      const status: "paid" | "pending" = netPayable === 0 ? "paid" : "pending";

      // ── 5. Insert invoice with FROZEN adjustment snapshot ──
      const { error: invErr } = await supabase.from("invoices").insert({
        id:                 invoiceId,
        tenant_id:          quote.tenant_id,
        customer_id:        quote.customer_id,
        customer_name:      quote.customer_name,
        amount:             grossAmount,
        status,
        invoice_date:       today,
        due_date:           dueDate,
        paid_date:          status === "paid" ? today : null,
        razorpay_id:        quote.payment_method === "razorpay" ? quote.payment_reference : null,
        adjusted_advances:  advances,
        net_payable:        netPayable,
        first_advance_at:   firstAdvanceAt,
        quote_id:           quote.id,
      });
      if (invErr) throw invErr;

      // ── 6. Mark quote as invoiced (terminal state) ──
      const { error: qUpdErr } = await supabase
        .from("quotes")
        .update({ payment_status: "invoiced", invoice_id: invoiceId })
        .eq("id", quoteId);
      if (qUpdErr) throw qUpdErr;

      return { invoiceId, netPayable, totalAdvances };
    },
    onSuccess: ({ invoiceId, netPayable, totalAdvances }) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["nav-badges"] });
      if (totalAdvances > 0 && netPayable > 0) {
        toast.success(
          `Invoice ${invoiceId} generated · ₹${totalAdvances.toLocaleString("en-IN")} advance adjusted · ₹${netPayable.toLocaleString("en-IN")} payable`,
        );
      } else if (netPayable === 0) {
        toast.success(`Invoice ${invoiceId} generated · fully settled by advances`);
      } else {
        toast.success(`Invoice ${invoiceId} generated · ₹${netPayable.toLocaleString("en-IN")} payable`);
      }
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useCustomerQuotes(customerId: string | undefined) {
  return useQuery({
    queryKey: ["quotes", "customer", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<any[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("customer_id", customerId!)
        .order("created_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
