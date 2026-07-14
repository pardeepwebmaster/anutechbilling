/**
 * Inbound emails — the Enquiries Inbox data layer.
 *
 * Reads the tenant's inbound_emails log (RLS-scoped, migration 0069/0079) and
 * exposes an atomic "convert to lead" action backed by the
 * convert_inbound_email_to_lead RPC.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { InboundEmailRow } from "@/lib/supabase/database.types";

export function useInboundEmails() {
  return useQuery({
    queryKey: ["inbound-emails"],
    queryFn: async (): Promise<InboundEmailRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConvertInboundToLead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("convert_inbound_email_to_lead", { p_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbound-emails"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["nav-badges"] });
      toast.success("Lead created from email");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}
