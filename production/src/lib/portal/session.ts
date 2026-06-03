/**
 * Portal session helper — used by Server Components to gate /portal/*
 * pages and to grab the customer + tenant for the logged-in customer user.
 *
 * Reseller-side auth helpers live elsewhere; this one is portal-specific.
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface PortalSession {
  userId:            string;
  userEmail:         string;
  customerId:        string;
  customerName:      string;
  tenantId:          string;
  tenantName:        string;
  tenantPhone:       string | null;
  tenantGstin:       string | null;
  tenantContactName: string | null;
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
    .select("customer_id, tenant_id, email, customers ( name ), tenants ( name, phone, gstin, contact_name )")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!link) return null;

  // Update last_login_at — best effort, ignore failure. Goes through a narrow
  // SECURITY DEFINER RPC (migration 0064): customers no longer have a direct
  // UPDATE path on customer_users, because a raw update with no WITH CHECK let
  // a customer re-point their own row's customer_id to another customer and read
  // that customer's data. The RPC stamps ONLY last_login_at on the caller's row.
  void supabase.rpc("portal_touch_login").then(() => {});

  // Supabase returns related-table fields as nested objects (single) or arrays
  // depending on the FK direction. Both `customers` and `tenants` are
  // single-row joins so we coerce defensively.
  const customer = (link.customers as unknown) as { name?: string } | null;
  const tenant   = (link.tenants   as unknown) as {
    name?: string; phone?: string | null; gstin?: string | null; contact_name?: string | null;
  } | null;

  return {
    userId:            user.id,
    userEmail:         user.email ?? link.email ?? "",
    customerId:        link.customer_id,
    customerName:      customer?.name ?? "Customer",
    tenantId:          link.tenant_id,
    tenantName:        tenant?.name   ?? "Reseller",
    tenantPhone:       tenant?.phone        ?? null,
    tenantGstin:       tenant?.gstin        ?? null,
    tenantContactName: tenant?.contact_name ?? null,
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
