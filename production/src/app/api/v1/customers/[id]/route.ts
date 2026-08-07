/**
 * GET /api/v1/customers/{billing_customer_id}
 * Customer lookup for the DSP integration. API-key auth, tenant-scoped.
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCustomer } from "@/lib/api/v1-customer";
import { mapCustomer } from "@/lib/api/v1-mappers";
import { unauthorized, notFound, badRequest } from "@/lib/api/v1-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const admin = createAdminClient();
  const customer = await resolveCustomer(admin, auth.tenantId, params.id);
  if (!customer) return notFound("Customer not found");

  const { count } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenantId)
    .eq("customer_id", customer.id)
    .eq("status", "active");

  return NextResponse.json(mapCustomer(customer, (count ?? 0) > 0));
}

/**
 * PATCH /api/v1/customers/{billing_customer_id}   { is_active: boolean }
 *
 * Used by Customer Panel to propagate an account deactivation/reactivation
 * here — e.g. an admin deactivates a customer's Customer Panel login, so
 * Billing stops sending them renewal reminders / generating new invoices
 * for them. Does NOT touch subscriptions/invoices/payments — deactivating
 * a customer is a status flag, not a delete (see delete_customer RPC for
 * why deletion itself is guarded against any real money history).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null) as { is_active?: boolean } | null;
  if (typeof body?.is_active !== "boolean") {
    return badRequest("is_active (boolean) is required");
  }

  const admin = createAdminClient();
  const customer = await resolveCustomer(admin, auth.tenantId, params.id);
  if (!customer) return notFound("Customer not found");

  // Cast: `is_active` is a real column (confirmed on live rows) but missing
  // from the generated CustomerUpdate type — stale relative to the schema.
  await admin.from("customers").update({ is_active: body.is_active } as never).eq("id", customer.id);

  return NextResponse.json({ updated: true, is_active: body.is_active });
}
