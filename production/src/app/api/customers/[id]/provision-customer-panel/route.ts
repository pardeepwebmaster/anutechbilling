/**
 * POST /api/customers/{id}/provision-customer-panel
 *
 * Session-authenticated (any signed-in tenant user — same permission level as
 * creating the customer itself). Triggered by the "Also create Customer Panel
 * account" checkbox on the customer form. Looks up the just-created customer,
 * then calls OUT to Customer Panel's inbound provisioning endpoint with a
 * dedicated write-capable key (CUSTOMER_PANEL_PROVISION_API_KEY) — kept
 * server-side here specifically so it's never exposed to the browser.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { billingCustomerId } from "@/lib/api/v1-mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, customer_number, name, contact_email")
    .eq("id", params.id)
    .single();
  if (error || !customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  if (!customer.contact_email) {
    return NextResponse.json(
      { error: "This customer has no contact email — add one before provisioning Customer Panel access." },
      { status: 400 }
    );
  }

  const apiUrl = process.env.CUSTOMER_PANEL_API_URL;
  const apiKey = process.env.CUSTOMER_PANEL_PROVISION_API_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "Customer Panel integration not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/integrations/billing/provision-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Integration-Key": apiKey },
      body: JSON.stringify({
        email: customer.contact_email,
        name: customer.name,
        billingCustomerId: billingCustomerId(customer),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: body.error || "Customer Panel rejected the request" }, { status: 502 });
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Could not reach Customer Panel" }, { status: 502 });
  }
}
