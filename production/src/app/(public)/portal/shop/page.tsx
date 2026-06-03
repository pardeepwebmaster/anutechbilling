/**
 * /portal/shop — cross-sell catalog for the logged-in customer.
 *
 * Products + pricing come from portal_list_products() (SECURITY DEFINER RPC,
 * customer-safe fields only — reseller wholesale/margin never leave the DB).
 * "Request a quote" creates a lead in the reseller's pipeline via
 * portal_request_quote(); no payment is taken here.
 */
import { requirePortalSession } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import { ShopClient } from "./shop-client";

export const dynamic = "force-dynamic";

export default async function PortalShopPage() {
  const session  = await requirePortalSession();
  const supabase = createClient();

  const { data: products } = await supabase.rpc("portal_list_products");

  // Flag plans the customer already runs, so we can mark them "Current plan".
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("status", "active");
  const ownedPlans = (subs ?? []).map((s) => s.plan);

  return (
    <ShopClient
      products={products ?? []}
      ownedPlans={ownedPlans}
      resellerName={session.tenantName}
      resellerPhone={session.tenantPhone}
    />
  );
}
