/**
 * GET /api/v1/customers/{billing_customer_id}/quotes
 * Quotes / pending payments for a customer. API-key auth, tenant-scoped.
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCustomer } from "@/lib/api/v1-customer";
import { mapQuote } from "@/lib/api/v1-mappers";
import { unauthorized, notFound } from "@/lib/api/v1-response";
import type { Quote as QuoteRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://resellersos.web.app";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const admin = createAdminClient();
  const customer = await resolveCustomer(admin, auth.tenantId, params.id);
  if (!customer) return notFound("Customer not found");

  const { data, error } = await admin
    .from("quotes")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("customer_id", customer.id)
    .order("created_date", { ascending: false });
  if (error) return notFound("Could not load quotes");

  return NextResponse.json((data as QuoteRow[]).map((q) => mapQuote(q, APP_URL)));
}
