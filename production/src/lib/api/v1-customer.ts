/**
 * Resolve the {billing_customer_id} path segment to a customer row, scoped to
 * the authenticated tenant. Accepts the customer_number (canonical) OR the raw
 * uuid id (fallback), so DSP can use either. Never crosses tenant boundaries.
 */
import type { createAdminClient } from "@/lib/supabase/server";
import type { Customer as CustomerRow } from "@/lib/supabase/database.types";

type Admin = ReturnType<typeof createAdminClient>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveCustomer(
  admin: Admin,
  tenantId: string,
  idOrNumber: string,
): Promise<CustomerRow | null> {
  const byNumber = await admin
    .from("customers").select("*")
    .eq("tenant_id", tenantId)
    .eq("customer_number", idOrNumber)
    .maybeSingle();
  if (byNumber.data) return byNumber.data as CustomerRow;

  if (UUID_RE.test(idOrNumber)) {
    const byId = await admin
      .from("customers").select("*")
      .eq("tenant_id", tenantId)
      .eq("id", idOrNumber)
      .maybeSingle();
    if (byId.data) return byId.data as CustomerRow;
  }
  return null;
}
