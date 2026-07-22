/**
 * Payroll + leave — TanStack Query hooks (migration 0087).
 *
 * Salary is booked as a Salaries EXPENSE (earned = gross − LOP); only the NET
 * pay leaves the bank. Advance recovery reduces the employee's loan (no cash);
 * withheld TDS/PF/ESI stay a liability until paid to govt. All money movement
 * is via the pay_salary / pay_statutory_dues RPCs so it stays atomic.
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/database.types";

export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type LeaveEntry = Database["public"]["Tables"]["leave_entries"]["Row"];
export type SalaryPayment = Database["public"]["Tables"]["salary_payments"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
export type LeaveKind = LeaveEntry["type"];

export const LEAVE_TYPE_LABEL: Record<LeaveKind, string> = {
  casual: "Casual", sick: "Sick", earned: "Earned", unpaid: "Unpaid (LOP)",
};

async function tenantId(): Promise<string> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) throw new Error("Not authenticated");
  const { data: me, error } = await supabase
    .from("users").select("tenant_id").eq("id", authData.user.id).single();
  if (error || !me) throw new Error("User not linked to a tenant");
  return me.tenant_id;
}

// ── Employees ───────────────────────────────────────────────────────────────
export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async (): Promise<Employee[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("is_active", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });
}

export function useUpsertEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; name: string; monthly_gross: number; joining_date?: string | null;
      leave_allowance?: number; pan?: string | null; pf_no?: string | null; esi_no?: string | null;
      is_active?: boolean; notes?: string | null;
    }) => {
      const supabase = createClient();
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase.from("employees").update(patch).eq("id", id);
        if (error) throw error;
        return id;
      }
      const tid = await tenantId();
      const { data, error } = await supabase.from("employees").insert({ ...input, tenant_id: tid }).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee saved");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

// ── Leave ─────────────────────────────────────────────────────────────────
export function useLeaveEntries() {
  return useQuery({
    queryKey: ["leave-entries"],
    queryFn: async (): Promise<LeaveEntry[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leave_entries")
        .select("*")
        .order("from_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeaveEntry[];
    },
  });
}

export function useCreateLeaveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      employee_id: string; from_date: string; to_date: string; days: number; type: LeaveKind; notes?: string | null;
    }) => {
      const supabase = createClient();
      const tid = await tenantId();
      const { error } = await supabase.from("leave_entries").insert({ ...input, tenant_id: tid });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-entries"] });
      toast.success("Leave recorded");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useDeleteLeaveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("leave_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-entries"] }); toast.success("Leave removed"); },
    onError: (err) => toast.error((err as Error).message),
  });
}

// ── Salary payments ─────────────────────────────────────────────────────────
export function useSalaryPayments(period?: string) {
  return useQuery({
    queryKey: ["salary-payments", period ?? "all"],
    queryFn: async (): Promise<SalaryPayment[]> => {
      const supabase = createClient();
      let q = supabase.from("salary_payments").select("*").order("period", { ascending: false });
      if (period) q = q.eq("period", period);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SalaryPayment[];
    },
  });
}

export function usePaySalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      employeeId: string; period: string; payDate: string; gross: number;
      lopDays: number; lopAmount: number; advanceRecovered: number; advanceLoanId?: string | null;
      tds: number; pf: number; esi: number; other: number; bankAccountId: string; notes?: string | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("pay_salary", {
        p_employee_id:       input.employeeId,
        p_period:            input.period,
        p_pay_date:          input.payDate,
        p_gross:             input.gross,
        p_lop_days:          input.lopDays,
        p_lop_amount:        input.lopAmount,
        p_advance_recovered: input.advanceRecovered,
        p_advance_loan_id:   input.advanceRecovered > 0 ? (input.advanceLoanId ?? null) : null,
        p_tds:               input.tds,
        p_pf:                input.pf,
        p_esi:               input.esi,
        p_other:             input.other,
        p_bank_account_id:   input.bankAccountId,
        p_notes:             input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-payments"] });
      qc.invalidateQueries({ queryKey: ["employee-loans"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["balance-sheet"] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      qc.invalidateQueries({ queryKey: ["statutory-dues"] });
      toast.success("Salary paid");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

// ── Statutory dues (withheld TDS/PF/ESI vs paid) ─────────────────────────────
export function useStatutoryDues() {
  return useQuery({
    queryKey: ["statutory-dues"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: sal, error: sErr } = await supabase.from("salary_payments").select("tds, pf, esi");
      if (sErr) throw sErr;
      const withheld = (sal ?? []).reduce((s, r) => s + (r.tds ?? 0) + (r.pf ?? 0) + (r.esi ?? 0), 0);

      const { data: paid, error: pErr } = await supabase
        .from("statutory_dues_payments").select("amount");
      if (pErr) throw pErr;
      const paidTotal = (paid ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

      return { withheld, paid: paidTotal, payable: Math.max(0, withheld - paidTotal) };
    },
    staleTime: 30_000,
  });
}

// ── Attendance ──────────────────────────────────────────────────────────────
export function useAttendance(period?: string) {
  return useQuery({
    queryKey: ["attendance", period ?? "all"],
    queryFn: async (): Promise<Attendance[]> => {
      const supabase = createClient();
      let q = supabase.from("attendance").select("*").order("work_date", { ascending: false });
      if (period) q = q.gte("work_date", `${period}-01`).lte("work_date", `${period}-31`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Attendance[];
    },
    staleTime: 15_000,
  });
}

/** Short-lived signed URL for an attendance selfie (tenant-scoped by storage RLS). */
export async function getSelfieUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("attendance-selfies").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export function useSetEmployeePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employeeId: string; pin: string }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_employee_pin", { p_employee_id: input.employeeId, p_pin: input.pin });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("PIN set"); },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    // Goes through the API route so the office-network (IP) gate is enforced
    // server-side with the real client IP.
    mutationFn: async (input: { employeeId: string; pin: string; photo?: string | null }): Promise<string> => {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: input.employeeId, pin: input.pin, photo: input.photo ?? null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not mark attendance");
      return json.action as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); },
    // errors surfaced by the caller (kiosk shows inline feedback)
  });
}

export function useAttendanceNetwork() {
  return useQuery({
    queryKey: ["attendance-network"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/network");
      if (!res.ok) throw new Error("Failed to load network settings");
      return res.json() as Promise<{ allowedIps: string[]; currentIp: string; onAllowedNetwork: boolean; requireSelfie: boolean }>;
    },
    staleTime: 10_000,
  });
}

export function useSetAttendanceNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { action: "lock" | "clear" | "remove" | "require_selfie"; ip?: string; value?: boolean }) => {
      const res = await fetch("/api/attendance/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed");
      return json as { allowedIps: string[]; currentIp: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance-network"] }); toast.success("Attendance network updated"); },
    onError: (e) => toast.error((e as Error).message),
  });
}

export function usePayStatutoryDues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount: number; kind: string; paidOn: string; bankAccountId: string; notes?: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("pay_statutory_dues", {
        p_amount:          input.amount,
        p_kind:            input.kind,
        p_paid_on:         input.paidOn,
        p_bank_account_id: input.bankAccountId,
        p_notes:           input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["statutory-dues"] });
      qc.invalidateQueries({ queryKey: ["balance-sheet"] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      toast.success("Statutory dues paid");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}
