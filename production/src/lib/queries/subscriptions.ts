/**
 * Subscriptions — TanStack Query hooks.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Subscription } from "@/lib/supabase/database.types";

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async (): Promise<Subscription[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("renewal_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Inline-edit hook for setting the domain on an existing subscription.
 * Used by Subscriptions page when an older row was created before the
 * structured `domain` flow existed and lacks the value.
 *
 * Also bubbles the domain up to the customer record (when one is linked)
 * so future leads/quotes auto-populate it.
 */
export function useSetSubscriptionDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, domain }: { id: string; domain: string }) => {
      const clean = domain
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "")
        .trim();
      if (!clean) throw new Error("Domain required");

      const supabase = createClient();

      // Update subscription
      const { data: subRow, error: subErr } = await supabase
        .from("subscriptions")
        .update({ domain: clean })
        .eq("id", id)
        .select("id, customer_id, domain")
        .single();
      if (subErr) throw subErr;

      // Best-effort: keep customer.domain in sync (don't overwrite if customer
      // already has one — operator may have entered a different identity domain).
      if (subRow?.customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("domain")
          .eq("id", subRow.customer_id)
          .maybeSingle();
        if (cust && !cust.domain) {
          await supabase
            .from("customers")
            .update({ domain: clean })
            .eq("id", subRow.customer_id);
        }
      }
      return subRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Filter subscriptions for a specific customer */
export function useCustomerSubscriptions(customerId: string | undefined) {
  return useQuery({
    queryKey: ["subscriptions", "customer", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<Subscription[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("customer_id", customerId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
