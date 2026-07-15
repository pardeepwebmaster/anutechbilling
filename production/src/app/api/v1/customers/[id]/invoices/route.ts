/**
 * GET /api/v1/customers/{billing_customer_id}/invoices
 * Invoices for a customer. API-key auth, tenant-scoped.
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCustomer } from "@/lib/api/v1-customer";
import { mapInvoice } from "@/lib/api/v1-mappers";
import { pdfDownloadUrl } from "@/lib/pdf/pdf-token";
import { unauthorized, notFound } from "@/lib/api/v1-response";
import type { Invoice as InvoiceRow } from "@/lib/supabase/database.types";

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
    .from("invoices")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("customer_id", customer.id)
    .order("invoice_date", { ascending: false });
  if (error) return notFound("Could not load invoices");

  return NextResponse.json(
    (data as InvoiceRow[]).map((inv) =>
      mapInvoice(inv, pdfDownloadUrl(APP_URL, "invoice", inv.id, auth.tenantId)),
    ),
  );
}
