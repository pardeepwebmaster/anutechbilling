/**
 * GET /api/aa/setu/callback?handle=<consent_handle_id>&approved=<bool>
 *
 * Setu redirects the user here after they approve/reject consent on their
 * phone. (In mock mode, the local /aa/simulate-approval page calls this.)
 * We update the connection row to active and redirect back to the bank
 * account detail page.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConsentStatus } from "@/lib/aa/setu";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url      = new URL(req.url);
  const handle   = url.searchParams.get("handle");
  const approved = url.searchParams.get("approved") !== "false";

  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }

  const supabase = await createClient();

  // Find the connection row by handle
  const { data: conn, error: connErr } = await supabase
    .from("bank_aa_connections")
    .select("id, bank_account_id, tenant_id")
    .eq("consent_handle_id", handle)
    .single();
  if (connErr || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (!approved) {
    await supabase
      .from("bank_aa_connections")
      .update({ status: "rejected", status_reason: "User declined consent" })
      .eq("id", conn.id);
    return NextResponse.redirect(new URL(`/accounting/banking/${conn.bank_account_id}?aa=rejected`, req.url));
  }

  // Pull final status from provider (returns mock-active in mock mode)
  const status = await getConsentStatus(handle);
  const linked = status.linked_accounts?.[0];

  await supabase
    .from("bank_aa_connections")
    .update({
      status:             "active",
      consent_id:         status.consent_id ?? null,
      linked_account_ref: linked?.accountRef ?? null,
      status_reason:      null,
    })
    .eq("id", conn.id);

  return NextResponse.redirect(new URL(`/accounting/banking/${conn.bank_account_id}?aa=connected`, req.url));
}
