/**
 * Portal session helper — used by Server Components to gate /portal/*
 * pages and to grab the customer + tenant for the logged-in customer user.
 *
 * Reseller-side auth helpers live elsewhere; this one is portal-specific.
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface PortalSession {
  userId:       string;
  userEmail:    string;
  customerId:   string;
  customerName: string;
  tenantId:     string;
  tenantName:   string;
}

/**
 * Resolve the portal session from cookies. Returns null when the auth user
 * is not linked to any customer (or not authenticated at all).
 *
 * For Server Components that should redirect non-customers to login, use
 * `requirePortalSession()` below instead.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: link } = await supabase
    .from("customer_users")
    .select("customer_id, tenant_id, email, customers ( name ), tenants ( name )")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!link) return null;

  // Update last_login_at — best effort, ignore failure
  void supabase
    .from("customer_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("auth_user_id", user.id)
    .then(() => {});

  // Supabase returns related-table fields as nested objects (single) or arrays
  // depending on the FK direction. Both `customers` and `tenants` are
  // single-row joins so we coerce defensively.
  const customer = (link.customers as unknown) as { name?: string } | null;
  const tenant   = (link.tenants   as unknown) as { name?: string } | null;

  return {
    userId:       user.id,
    userEmail:    user.email ?? link.email ?? "",
    customerId:   link.customer_id,
    customerName: customer?.name ?? "Customer",
    tenantId:     link.tenant_id,
    tenantName:   tenant?.name   ?? "Reseller",
  };
}

/**
 * Like getPortalSession but redirects to /portal/login when there's no
 * matching customer user. Use this at the top of any protected page.
 */
export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  return session;
}
