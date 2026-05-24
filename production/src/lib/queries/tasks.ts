/**
 * Tasks — follow-up to-dos for sales reps.
 *
 * All hooks are tenant-scoped via RLS. Mutations fetch the current
 * tenant_id + auth.uid() for the owner on create (same pattern as
 * useCreateLead).
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Database, Task } from "@/lib/supabase/database.types";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

// ────────────────────────────────────────────────────────────────
// Filters
// ────────────────────────────────────────────────────────────────

export type TaskBucket = "today" | "overdue" | "upcoming" | "done" | "all";

/**
 * Compute the IST date boundary for "today" — used to slice tasks
 * into Today / Upcoming / Overdue buckets without TZ confusion.
 */
function todayBoundariesIST(): { startISO: string; endISO: string } {
  const now = new Date();
  // Convert "now" to IST string then back to a Date so we get IST midnight
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const istMid = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  // Subtract 5.5h to express IST midnight as a UTC instant
  const startUTC = new Date(istMid.getTime() - (5.5 * 60 * 60 * 1000));
  const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return { startISO: startUTC.toISOString(), endISO: endUTC.toISOString() };
}

// ────────────────────────────────────────────────────────────────
// Reads
// ────────────────────────────────────────────────────────────────

/** All tasks in the tenant. Used by the /tasks list page. */
export function useTasks(bucket: TaskBucket = "all") {
  return useQuery({
    queryKey: ["tasks", bucket],
    queryFn: async (): Promise<Task[]> => {
      const supabase = createClient();
      let q = supabase.from("tasks").select("*");

      const { startISO, endISO } = todayBoundariesIST();

      switch (bucket) {
        case "today":
          q = q.eq("status", "pending").gte("due_at", startISO).lt("due_at", endISO);
          break;
        case "overdue":
          q = q.eq("status", "pending").lt("due_at", startISO);
          break;
        case "upcoming":
          q = q.eq("status", "pending").gte("due_at", endISO);
          break;
        case "done":
          q = q.eq("status", "done");
          break;
        case "all":
        default:
          // no filter
          break;
      }

      const order: { ascending: boolean } = { ascending: bucket === "upcoming" || bucket === "today" };
      const { data, error } = await q.order("due_at", order);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Tasks linked to a specific lead — used inside the lead drawer.
 * Excludes 'cancelled' since those are out of mind for the rep.
 */
export function useTasksForLead(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ["tasks", "by-lead", leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<Task[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("lead_id", leadId!)
        .neq("status", "cancelled")
        .order("due_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * "Today + overdue" count for the top-bar bell badge.
 * Cheap query — count(*) head-only.
 */
export function useTaskCountDueOrOverdue() {
  return useQuery({
    queryKey: ["tasks", "count-due-or-overdue"],
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { endISO } = todayBoundariesIST();
      // pending AND due_at < endOfToday (covers both overdue + today)
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("due_at", endISO);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
}

// ────────────────────────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────────────────────────

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TaskInsert, "tenant_id" | "owner_id"> & { owner_id?: string | null }) => {
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
        .from("tasks")
        .insert({
          ...input,
          tenant_id: me.tenant_id,
          owner_id:  input.owner_id ?? authData.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Follow-up scheduled");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

/** Generic patch — most callers want completeTask / snoozeTask helpers below. */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

/** Mark a task done. Completion stamps (completed_at, completed_by) are
 *  applied by the DB trigger. */
export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .update({ status: "done" })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Marked done ✓");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

/** Push the due_at forward by N minutes (default 24h) and bump snooze_count. */
export function useSnoozeTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, minutes = 24 * 60 }: { id: string; minutes?: number }) => {
      const supabase = createClient();
      // Read current task to compute new due_at + snooze_count
      const { data: cur, error: rErr } = await supabase
        .from("tasks").select("due_at, snooze_count").eq("id", id).single();
      if (rErr || !cur) throw rErr ?? new Error("Task not found");

      const newDue = new Date(new Date(cur.due_at).getTime() + minutes * 60_000);

      const { data, error } = await supabase
        .from("tasks")
        .update({
          due_at: newDue.toISOString(),
          snooze_count: (cur.snooze_count ?? 0) + 1,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast(`Snoozed to ${new Date(data.due_at).toLocaleString("en-IN")}`);
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}
