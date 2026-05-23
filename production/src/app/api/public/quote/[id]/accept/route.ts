/**
 * POST /api/public/quote/[id]/accept
 *
 * Customer-side action: marks the quote as accepted + sets payment_status to awaiting.
 * Uses admin client (bypasses RLS) since the customer isn't authenticated.
 * Quote ID is the implicit secret.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  // 1. Fetch the quote to validate state
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, status, payment_status, expires_date, customer_name, tenant_id")
    .eq("id", params.id)
    .maybeSingle();

  if (qErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // 2. Reject drafts / already-accepted / rejected / expired
  if (quote.status === "draft") {
    return NextResponse.json({ error: "This quote hasn't been sent yet" }, { status: 400 });
  }
  if (quote.status === "accepted") {
    return NextResponse.json({ ok: true, already: true });
  }
  if (quote.status === "rejected") {
    return NextResponse.json({ error: "This quote was rejected — please reach out to the reseller" }, { status: 400 });
  }
  if (quote.expires_date && new Date(quote.expires_date) < new Date()) {
    return NextResponse.json({ error: "This quote has expired — please ask the reseller for a fresh one" }, { status: 400 });
  }

  // 3. Mark as accepted (DB trigger should auto-set payment_status to 'awaiting')
  const { error: updateErr } = await supabase
    .from("quotes")
    .update({
      status: "accepted",
      payment_status: "awaiting",
    })
    .eq("id", params.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 4. TODO: send notification email to the reseller (P3 Resend integration)
  //    For now this is just logged.
  console.info(`[quote-accept] ${params.id} accepted by ${quote.customer_name} (tenant ${quote.tenant_id})`);

  return NextResponse.json({ ok: true });
}
