/**
 * Tenant helpers — current tenant + user resolution.
 *
 * Server-side. For client components, use the same helpers via Server Action
 * or pass tenant context via React Context (avoids re-fetching).
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tenant, DBUser } from "@/lib/supabase/database.types";

export interface CurrentUser {
  authUserId: string;
  email: string;
  tenant: Tenant;
  user: DBUser;
}

/**
 * Get the current authenticated user with tenant context.
 * Throws if not authenticated — call from protected routes only.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return null;

  // Fetch our public.users row (which has tenant_id + role)
  const { data: userRow } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (!userRow) return null;

  // Fetch the tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", userRow.tenant_id)
    .single();

  if (!tenant) return null;

  return {
    authUserId: authData.user.id,
    email: authData.user.email ?? userRow.email,
    tenant,
    user: userRow,
  };
}

/**
 * Get current tenant ID via the public.users join.
 * Returns null if not authenticated or no tenant assigned.
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", authData.user.id)
    .single();

  if (error || !data) return null;
  return data.tenant_id;
}
