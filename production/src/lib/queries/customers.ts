/**
 * Customers — TanStack Query hooks.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Database } from "@/lib/supabase/database.types";

type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];

// ============================================================
// List
// ============================================================
export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async (): Promise<Customer[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ============================================================
// Single
// ============================================================
export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    enabled: !!id,
    queryFn: async (): Promise<Customer | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ============================================================
// Create — fetches current tenant_id automatically
// ============================================================
export function useCreateCustomer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CustomerInsert, "tenant_id">) => {
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
        .from("customers")
        .insert({ ...input, tenant_id: me.tenant_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer added");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

// ============================================================
// Update
// ============================================================
export function useUpdateCustomer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CustomerUpdate }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", data.id] });
      toast.success("Customer updated");
    },
    onError: (err) => toast.error((err as Error).message),
  });
}
