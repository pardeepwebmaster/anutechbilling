/**
 * Vendors master (migration 0134) — suppliers you buy from (Google CSP,
 * Microsoft, Zoho, etc.). Each vendor rolls up its bills: total billed +
 * outstanding + bill count, so you see "kisko kitna dena" on the buy side.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { VendorRow } from "@/lib/supabase/database.types";
import type { VendorBill } from "@/lib/queries/vendor-bills";

export type Vendor = VendorRow & {
  billCount:   number;
  totalBilled: number;
  outstanding: number;
  lastBillDate: string | null;
};

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async (): Promise<Vendor[]> => {
      const supabase = createClient();
      const { data: vendors, error } = await supabase.from("vendors").select("*").order("name", { ascending: true });
      if (error) throw error;
      const { data: bills, error: bErr } = await supabase
        .from("vendor_bills").select("vendor_id, total, paid_amount, bill_date");
      if (bErr) throw bErr;

      const agg = new Map<string, { count: number; total: number; out: number; last: string | null }>();
      for (const b of bills ?? []) {
        if (!b.vendor_id) continue;
        const cur = agg.get(b.vendor_id) ?? { count: 0, total: 0, out: 0, last: null };
        cur.count += 1;
        cur.total += b.total ?? 0;
        cur.out   += Math.max(0, (b.total ?? 0) - (b.paid_amount ?? 0));
        if (b.bill_date && (!cur.last || b.bill_date > cur.last)) cur.last = b.bill_date;
        agg.set(b.vendor_id, cur);
      }
      return (vendors ?? []).map((v) => {
        const a = agg.get(v.id) ?? { count: 0, total: 0, out: 0, last: null };
        return { ...(v as VendorRow), billCount: a.count, totalBilled: a.total, outstanding: a.out, lastBillDate: a.last };
      });
    },
    staleTime: 30_000,
  });
}

/** Bills belonging to one vendor (for the detail view). */
export function useBillsByVendor(vendorId: string | null | undefined) {
  return useQuery({
    queryKey: ["vendor_bills", "by-vendor", vendorId],
    enabled: Boolean(vendorId),
    queryFn: async (): Promise<VendorBill[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vendor_bills").select("*").eq("vendor_id", vendorId!).order("bill_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendorBill[];
    },
  });
}

/**
 * Find-or-create a vendor by name (case-insensitive) and return its id. Used
 * when saving a bill so every bill links to the master — no orphan text names,
 * and typing a new supplier auto-adds it to Vendors. Backfills a missing
 * gstin/category onto an existing vendor.
 */
export async function ensureVendor(input: { name: string; gstin?: string | null; defaultCategory?: string | null }): Promise<string | null> {
  const name = input.name.trim();
  if (!name) return null;
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return null;
  const { data: me } = await supabase.from("users").select("tenant_id").eq("id", authData.user.id).single();
  if (!me) return null;

  const findExisting = async () => {
    const { data } = await supabase.from("vendors").select("id, gstin, default_category").ilike("name", name).limit(1);
    return data?.[0] ?? null;
  };

  const existing = await findExisting();
  if (existing) {
    const patch: { gstin?: string; default_category?: string } = {};
    if (!existing.gstin && input.gstin) patch.gstin = input.gstin;
    if (!existing.default_category && input.defaultCategory) patch.default_category = input.defaultCategory;
    if (Object.keys(patch).length) await supabase.from("vendors").update(patch).eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("vendors")
    .insert({ tenant_id: me.tenant_id, name, gstin: input.gstin || null, default_category: input.defaultCategory || null })
    .select("id").single();
  if (error) {
    // Likely a concurrent insert hit the unique index — re-find and use it.
    const again = await findExisting();
    return again?.id ?? null;
  }
  return created?.id ?? null;
}

export function useUpsertVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; name: string; gstin?: string | null;
      contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null;
      defaultCategory?: string | null; notes?: string | null;
      address?: string | null; city?: string | null; state?: string | null; pincode?: string | null;
    }) => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Not authenticated");
      const { data: me, error: meErr } = await supabase
        .from("users").select("tenant_id").eq("id", authData.user.id).single();
      if (meErr || !me) throw new Error("User not linked to a tenant");

      const row = {
        name:             input.name.trim(),
        gstin:            input.gstin?.trim() || null,
        contact_name:     input.contactName?.trim() || null,
        contact_email:    input.contactEmail?.trim() || null,
        contact_phone:    input.contactPhone?.trim() || null,
        default_category: input.defaultCategory || null,
        address:          input.address?.trim() || null,
        city:             input.city?.trim() || null,
        state:            input.state?.trim() || null,
        pincode:          input.pincode?.trim() || null,
        notes:            input.notes?.trim() || null,
      };
      if (input.id) {
        const { error } = await supabase.from("vendors").update(row).eq("id", input.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("vendors").insert({ ...row, tenant_id: me.tenant_id });
        if (error) throw new Error(error.message.includes("vendors_tenant_name_uniq") ? "A vendor with this name already exists." : error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor saved");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      // Bills keep their text name; the FK is set null on delete (migration 0134).
      const { error } = await supabase.from("vendors").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendor_bills"] });
      toast.success("Vendor removed");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}
