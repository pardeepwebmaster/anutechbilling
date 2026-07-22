/**
 * Lead activity timeline — TanStack Query hooks (migration 0096).
 *
 * A per-lead communication log: outbound touches the rep makes (email, call,
 * WhatsApp, follow-up) and inbound emails captured by the webhook. Powers the
 * "what happened, when" timeline on the lead drawer.
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/database.types";

export type LeadActivityRow = Database["public"]["Tables"]["lead_activities"]["Row"];
export type LeadActivityKind = "email" | "call" | "whatsapp" | "note" | "email_in" | "quote" | "stage";

export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead-activities", leadId],
    enabled: Boolean(leadId),
    queryFn: async (): Promise<LeadActivityRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadActivityRow[];
    },
    staleTime: 15_000,
  });
}

export function useLogLeadActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { leadId: string; kind: LeadActivityKind; detail?: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("log_lead_activity", {
        p_lead_id: input.leadId,
        p_kind:    input.kind,
        p_detail:  input.detail ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["lead-activities", v.leadId] }); },
    onError: (err) => toast.error(`Couldn't log activity: ${(err as Error).message}`),
  });
}
