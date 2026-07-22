/**
 * Project / one-time sales (custom software etc.) — TanStack Query hooks.
 *
 * A project sale is billed in milestones (installments), each of which can be
 * turned into a proper GST Tax Invoice and paid. Revenue flows through the
 * normal `invoices` table; receivable = project total − payments received.
 *
 * Deliberately separate from the subscription money-spine — no subscription,
 * no vendor PO, no renewal is ever created here.
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type {
  ProjectSaleRow,
  ProjectMilestoneRow,
  ProjectPaymentRow,
} from "@/lib/supabase/database.types";

export type { ProjectSaleRow, ProjectMilestoneRow, ProjectPaymentRow };

export type ProjectSaleWithTotals = ProjectSaleRow & {
  paid:        number;   // Σ payments received
  receivable:  number;   // total − paid
};

export type MilestoneInput = {
  label:        string;
  total_amount: number;   // GST-inclusive amount due this installment
  due_date:     string | null;
};

// ── List ─────────────────────────────────────────────────────────────────────
export function useProjectSales() {
  return useQuery({
    queryKey: ["project_sales"],
    queryFn: async (): Promise<ProjectSaleWithTotals[]> => {
      const supabase = createClient();
      const { data: projects, error } = await supabase
        .from("project_sales")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: pays, error: pErr } = await supabase
        .from("project_payments")
        .select("project_id, amount");
      if (pErr) throw pErr;

      const paidBy = new Map<string, number>();
      for (const p of pays ?? []) {
        paidBy.set(p.project_id, (paidBy.get(p.project_id) ?? 0) + (p.amount ?? 0));
      }
      return (projects ?? []).map((pr) => {
        const paid = paidBy.get(pr.id) ?? 0;
        return { ...(pr as ProjectSaleRow), paid, receivable: Math.max(0, (pr.total_amount ?? 0) - paid) };
      });
    },
    staleTime: 30_000,
  });
}

// ── Single project (with milestones + payments) ───────────────────────────────
export function useProjectSale(id: string | null | undefined) {
  return useQuery({
    queryKey: ["project_sales", id],
    enabled:  Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const [{ data: project, error: e1 }, { data: milestones, error: e2 }, { data: payments, error: e3 }] =
        await Promise.all([
          supabase.from("project_sales").select("*").eq("id", id).single(),
          supabase.from("project_milestones").select("*").eq("project_id", id).order("seq", { ascending: true }),
          supabase.from("project_payments").select("*").eq("project_id", id).order("received_at", { ascending: false }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      const paid = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
      return {
        project:    project as ProjectSaleRow,
        milestones: (milestones ?? []) as ProjectMilestoneRow[],
        payments:   (payments ?? []) as ProjectPaymentRow[],
        paid,
        receivable: Math.max(0, (project?.total_amount ?? 0) - paid),
      };
    },
  });
}

// ── Create ─────────────────────────────────────────────────────────────────────
export function useCreateProjectSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customerId:   string | null;
      customerName: string;
      title:        string;
      description:  string | null;
      taxable:      number;
      gstRate:      number;
      interState:   boolean;
      milestones:   MilestoneInput[];
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_project_sale", {
        p_customer_id:   input.customerId,
        p_customer_name: input.customerName,
        p_title:         input.title,
        p_description:   input.description,
        p_taxable:       input.taxable,
        p_gst_rate:      input.gstRate,
        p_inter_state:   input.interState,
        p_milestones:    input.milestones,
      });
      if (error) throw error;
      return data as string;   // project id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_sales"] });
      toast.success("Project created");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create project"),
  });
}

// ── Raise a milestone's Tax Invoice ───────────────────────────────────────────
export function useRaiseMilestoneInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { milestoneId: string; projectId: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("raise_project_milestone_invoice", {
        p_milestone_id: input.milestoneId,
      });
      if (error) throw error;
      return data as string;   // invoice id
    },
    onSuccess: (invId, vars) => {
      qc.invalidateQueries({ queryKey: ["project_sales", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["project_sales"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Tax invoice ${invId} raised`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not raise invoice"),
  });
}

// ── Record a payment against a milestone ──────────────────────────────────────
export function useRecordProjectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      milestoneId: string;
      projectId:   string;
      amount:      number;
      method:      string | null;
      reference:   string | null;
      receivedAt:  string;
      bankTxnId?:  string | null;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("record_project_payment", {
        p_milestone_id: input.milestoneId,
        p_amount:       input.amount,
        p_method:       input.method,
        p_reference:    input.reference,
        p_received_at:  input.receivedAt,
        p_bank_txn_id:  input.bankTxnId ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["project_sales", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["project_sales"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      toast.success("Payment recorded");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not record payment"),
  });
}
