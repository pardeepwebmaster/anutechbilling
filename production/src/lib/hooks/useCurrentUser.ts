/**
 * useCurrentUser — fetches the logged-in user + their tenant name.
 * Used by Sidebar and TopBar to show real names instead of hardcoded "Excel Technologies".
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface CurrentUserInfo {
  userId:        string;
  authEmail:     string;
  fullName:      string | null;
  initials:      string | null;
  color:         string | null;
  role:          string | null;
  tenantId:      string;
  tenantName:    string;
  /** Tenant billing identity — used by Receipt Voucher / Invoice PDFs */
  tenantGstin:   string | null;
  tenantEmail:   string | null;
  tenantPhone:   string | null;
  tenantAddress: string | null;
  tenantState:   string | null;
  tenantStateCode: string | null;
  /** Days of buffer between renewal_date and auto-suspend (0–30). */
  tenantGracePeriodDays: number;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async (): Promise<CurrentUserInfo | null> => {
      const supabase = createClient();

      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return null;

      const { data: me, error } = await supabase
        .from("users")
        .select("id, tenant_id, full_name, initials, color, role, tenants(name, gstin, email, phone, address, state, state_code, grace_period_days)")
        .eq("id", authData.user.id)
        .single();

      if (error || !me) return null;

      const tenant = Array.isArray(me.tenants) ? me.tenants[0] : me.tenants;

      return {
        userId:          me.id,
        authEmail:       authData.user.email ?? "",
        fullName:        me.full_name,
        initials:        me.initials,
        color:           me.color,
        role:            me.role,
        tenantId:        me.tenant_id,
        tenantName:      tenant?.name ?? "Workspace",
        tenantGstin:     tenant?.gstin     ?? null,
        tenantEmail:     tenant?.email     ?? null,
        tenantPhone:     tenant?.phone     ?? null,
        tenantAddress:   tenant?.address   ?? null,
        tenantState:     tenant?.state     ?? null,
        tenantStateCode: tenant?.state_code ?? null,
        tenantGracePeriodDays: tenant?.grace_period_days ?? 0,
      };
    },
    staleTime: 5 * 60_000,  // 5 min — identity rarely changes
  });
}
