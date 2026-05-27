/**
 * Site Promos — TanStack Query hooks.
 *
 * Admin panel (/online-promos page) reads + mutates via these hooks.
 * Public buy page hits /api/public/site-promo/current to fetch the
 * currently-active promo (no auth, service-role inside the route).
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  SitePromoRow,
  SitePromoBannerStyle,
  CouponDiscountType,
} from "@/lib/supabase/database.types";

export function useSitePromos() {
  return useQuery({
    queryKey: ["site_promos"],
    queryFn: async (): Promise<SitePromoRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("site_promos")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SitePromoRow[];
    },
  });
}

interface CreateSitePromoInput {
  headline:          string;
  subheadline?:      string | null;
  badge_text?:       string | null;
  discount_type:     CouponDiscountType;
  discount_value:    number;
  applies_to_tier?:  string | null;
  min_seats?:        number;
  max_seats?:        number | null;
  banner_style?:     SitePromoBannerStyle;
  valid_until?:      string | null;
}

export function useCreateSitePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSitePromoInput): Promise<string> => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Not authenticated");
      const { data: me } = await supabase
        .from("users").select("tenant_id").eq("id", auth.user.id).single();
      if (!me?.tenant_id) throw new Error("No tenant context");

      const { data, error } = await supabase.rpc("create_site_promo", {
        p_tenant_id:       me.tenant_id,
        p_headline:        input.headline.trim(),
        p_subheadline:     input.subheadline ?? null,
        p_badge_text:      input.badge_text ?? null,
        p_discount_type:   input.discount_type,
        p_discount_value:  input.discount_value,
        p_applies_to_tier: input.applies_to_tier?.toLowerCase() || null,
        p_min_seats:       input.min_seats ?? 1,
        p_max_seats:       input.max_seats ?? null,
        p_banner_style:    input.banner_style ?? "amber",
        p_valid_until:     input.valid_until ?? null,
        p_created_by:      auth.user.id,
      });
      if (error) throw error;
      return (data as unknown as string);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_promos"] }),
  });
}

export function useToggleSitePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("site_promos")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_promos"] }),
  });
}

export function useDeleteSitePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("site_promos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_promos"] }),
  });
}
