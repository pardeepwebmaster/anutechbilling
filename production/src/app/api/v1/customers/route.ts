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
import { unauthorized, notFound, badRequest } from "@/lib/api/v1-response";
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

/**
 * POST /api/v1/customers   { name, email }
 *
 * Identity-only create-or-link, used by Customer Panel to keep a Billing
 * contact in sync for (a) an admin's manual "Also create Billing account"
 * checkbox and (b) a real self-service purchase. Deliberately creates a bare
 * contact — no invoice, no subscription. Idempotent by email within the
 * tenant: a second call for the same person links to the existing row
 * instead of creating a duplicate.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null) as { name?: string; email?: string } | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim();
  if (!name || !email) return badRequest("name and email are required");

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("customers").select("*")
    .eq("tenant_id", auth.tenantId)
    .ilike("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const customer = existing as CustomerRow;
    const active = await activeCustomerIds(admin, auth.tenantId, [customer.id]);
    return NextResponse.json({ created: false, ...mapCustomer(customer, active.has(customer.id)) });
  }

  const { data: created, error } = await admin
    .from("customers")
    .insert({ tenant_id: auth.tenantId, name, contact_email: email })
    .select("*")
    .single();
  if (error || !created) return badRequest("Could not create customer");

  return NextResponse.json({ created: true, ...mapCustomer(created as CustomerRow, false) });
}
