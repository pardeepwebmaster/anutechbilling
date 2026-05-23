/**
 * Tenant — TanStack Query mutation hook for updating the current
 * reseller's identity (GSTIN, address, contact details, etc.).
 *
 * RLS policy `tenants_self_update` already restricts UPDATE to the
 * authenticated user's own tenant AND requires role='owner'. The
 * client just needs to call .update() — the policy enforces both.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

export function useUpdateTenant() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patch: TenantUpdate) => {
      const supabase = createClient();

      // Resolve current tenant_id (RLS will further enforce ownership)
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Not authenticated");

      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", authData.user.id)
        .single();
      if (meErr || !me) throw new Error("User not linked to a tenant");

      const { data, error } = await supabase
        .from("tenants")
        .update(patch)
        .eq("id", me.tenant_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // useCurrentUser caches tenant — refresh it so the new values appear in
      // Sidebar / TopBar / PDFs / dashboard greeting immediately.
      qc.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Company info updated");
    },
    onError: (err) => toast.error(`Update failed: ${(err as Error).message}`),
  });
}
