/**
 * GET /api/v1/customers?email=user@acme.com
 * Secondary lookup (fallback during initial link) — find a customer by email.
 * API-key auth, tenant-scoped. Returns the single best match (most recent).
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mapCustomer } from "@/lib/api/v1-mappers";
import { unauthorized, notFound, badRequest } from "@/lib/api/v1-response";
import type { Customer as CustomerRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const email = req.nextUrl.searchParams.get("email")?.trim();
  if (!email) return badRequest("Provide ?email= to look up a customer");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .ilike("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return notFound("Customer not found");

  const customer = data as CustomerRow;
  const { count } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenantId)
    .eq("customer_id", customer.id)
    .eq("status", "active");

  return NextResponse.json(mapCustomer(customer, (count ?? 0) > 0));
}
