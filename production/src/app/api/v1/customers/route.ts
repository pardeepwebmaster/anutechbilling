/**
 * GET /api/v1/customers
 *   ?email=user@acme.com   → single customer (secondary lookup / initial link)
 *   ?page=1&per_page=100   → paginated list of all customers ("Sync all")
 *
 * API-key auth, tenant-scoped. `status` (active/inactive) is derived from
 * whether the customer has any active subscription — computed for the whole
 * page in ONE query (no N+1).
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mapCustomer, mapCustomerListItem, parsePagination, paginationMeta } from "@/lib/api/v1-mappers";
import { unauthorized, notFound } from "@/lib/api/v1-response";
import type { Customer as CustomerRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** customer_ids (of this page) that have ≥1 active subscription. */
async function activeCustomerIds(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  customerIds: string[],
): Promise<Set<string>> {
  if (customerIds.length === 0) return new Set();
  const { data } = await admin
    .from("subscriptions")
    .select("customer_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("customer_id", customerIds);
  return new Set((data ?? []).map((r) => r.customer_id).filter((x): x is string => !!x));
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const admin = createAdminClient();
  const sp = req.nextUrl.searchParams;
  const email = sp.get("email")?.trim();

  // ── Single lookup by email ────────────────────────────────────────────
  if (email) {
    const { data, error } = await admin
      .from("customers").select("*")
      .eq("tenant_id", auth.tenantId)
      .ilike("contact_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return notFound("Customer not found");

    const customer = data as CustomerRow;
    const active = await activeCustomerIds(admin, auth.tenantId, [customer.id]);
    return NextResponse.json(mapCustomer(customer, active.has(customer.id)));
  }

  // ── Paginated list ────────────────────────────────────────────────────
  const { page, perPage, offset } = parsePagination(sp.get("page"), sp.get("per_page"));

  const { data, error, count } = await admin
    .from("customers")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: true })
    .range(offset, offset + perPage - 1);
  if (error) return notFound("Could not load customers");

  const rows = (data as CustomerRow[]) ?? [];
  const active = await activeCustomerIds(admin, auth.tenantId, rows.map((c) => c.id));

  return NextResponse.json({
    customers: rows.map((c) => mapCustomerListItem(c, active.has(c.id))),
    ...paginationMeta(count ?? 0, page, perPage),
  });
}
