/**
 * POST /api/public/quote/[id]/pay?t=<token>
 *
 * Customer-side "Pay online" from the public quote-accept page. Mirrors the
 * proven customer-portal invoice pay (`api/portal/invoice/[id]/pay`) and the
 * buy-page checkout: create a Razorpay Order with receipt = quote id, then the
 * existing `/api/webhooks/razorpay` handler settles it via `record_payment` on
 * capture (which converts the lead → customer + subscription for a first
 * payment — exactly what accepting-and-paying a quote should do).
 *
 * Auth = the unguessable ?t=<token> (same as the accept route). No login.
 * Never invents a parallel money path — settlement is record_payment via webhook.
 */
import { NextResponse, type NextRequest } from "next/server";
import Razorpay from "razorpay";
import { createAdminClient } from "@/lib/supabase/server";
import { isQuoteExpired } from "@/lib/utils";
import { quoteTokenMatches } from "@/lib/quotes/accept-token";

const ENV_RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || "";
const ENV_RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim() || "";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient();

  // ── 1. Load + token-authorize (identical secrecy model to the accept route) ──
  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .select("id, status, payment_status, expires_date, amount, currency, customer_name, tenant_id, public_token, invoice_id")
    .eq("id", params.id)
    .maybeSingle();

  if (qErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  const token = request.nextUrl.searchParams.get("t");
  if (!quoteTokenMatches(token, quote.public_token)) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // ── 2. State guards ─────────────────────────────────────────────────────
  if (quote.status === "draft") {
    return NextResponse.json({ error: "This quote hasn't been sent yet." }, { status: 400 });
  }
  if (quote.status === "rejected") {
    return NextResponse.json({ error: "This quote was rejected — please contact the reseller." }, { status: 400 });
  }
  // Already settled — never let the customer pay twice.
  if (quote.invoice_id || quote.payment_status === "received" || quote.payment_status === "invoiced") {
    return NextResponse.json({ error: "This quote is already paid." }, { status: 409 });
  }
  if (isQuoteExpired(quote.expires_date)) {
    return NextResponse.json({ error: "This quote has expired — ask the reseller for a fresh one." }, { status: 400 });
  }
  const amountInr = quote.amount ?? 0;
  if (amountInr <= 0) {
    return NextResponse.json({ error: "Nothing to pay on this quote." }, { status: 400 });
  }
  // Razorpay (Indian account) charges INR. A foreign-currency quote shows a
  // non-₹ total to the customer, so charging ₹ here would mismatch what they
  // see — route those to offline settlement instead.
  const isForeign = !!quote.currency && quote.currency.toUpperCase() !== "INR";
  if (isForeign) {
    return NextResponse.json(
      { error: "Online payment is available for ₹ invoices only — please contact the reseller to pay.", notConfigured: true },
      { status: 400 },
    );
  }

  // ── 3. Resolve the tenant's Razorpay creds (tenant_secrets → env) ────────
  let rzKeyId = "";
  let rzKeySecret = "";
  let rzMode: "test" | "live" = "test";
  {
    const { data: secrets } = await admin
      .from("tenant_secrets")
      .select("razorpay_key_id, razorpay_key_secret, razorpay_mode")
      .eq("tenant_id", quote.tenant_id)
      .maybeSingle();
    if (secrets?.razorpay_key_id && secrets.razorpay_key_secret) {
      rzKeyId = secrets.razorpay_key_id;
      rzKeySecret = secrets.razorpay_key_secret;
      rzMode = secrets.razorpay_mode === "live" ? "live" : "test";
    } else if (ENV_RAZORPAY_KEY_ID && ENV_RAZORPAY_KEY_SECRET) {
      rzKeyId = ENV_RAZORPAY_KEY_ID;
      rzKeySecret = ENV_RAZORPAY_KEY_SECRET;
      rzMode = ENV_RAZORPAY_KEY_ID.startsWith("rzp_live_") ? "live" : "test";
    }
  }
  const razorpayConfigured = Boolean(rzKeyId) && Boolean(rzKeySecret);

  // ── 3a. SIMULATION (no creds) — record_payment directly, gated to non-prod ─
  // record_payment on a first-payment quote converts the lead → customer +
  // subscription (the intended accept-and-pay outcome). Never settle a REAL
  // quote for ₹0 in production without keys.
  if (!razorpayConfigured) {
    const allowSimulation =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_QUOTE_PAY_SIMULATION === "1";
    if (!allowSimulation) {
      return NextResponse.json(
        {
          error: "Online payment isn't available yet — please contact the reseller to pay by bank transfer / UPI.",
          notConfigured: true,
        },
        { status: 503 },
      );
    }
    const simRef = `SIM-QUOTEPAY-${quote.id}`;
    const { error: rpcErr } = await admin.rpc("record_payment", {
      p_quote_id: quote.id,
      p_amount: amountInr,
      p_method: "razorpay",
      p_reference: simRef,
      p_notes: `[SIMULATION] Quote online payment · ${quote.id}`,
    });
    if (rpcErr) {
      console.error("[public/quote/pay] sim record_payment:", rpcErr.message);
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, simulated: true, quoteId: quote.id, amountRupees: amountInr });
  }

  // ── 3b. LIVE — create a Razorpay Order; the webhook records on capture ────
  try {
    const razorpay = new Razorpay({ key_id: rzKeyId, key_secret: rzKeySecret });
    const order = await razorpay.orders.create({
      amount: amountInr * 100, // paise
      currency: "INR",
      receipt: quote.id, // webhook reverse-looks-up the quote by receipt
      notes: {
        kind: "quote",
        quoteId: quote.id,
        tenantId: quote.tenant_id,
        customerName: quote.customer_name ?? "",
      },
    });
    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: amountInr * 100,
      currency: "INR",
      razorpayKeyId: rzKeyId,
      razorpayMode: rzMode,
      quoteId: quote.id,
      customerName: quote.customer_name ?? "",
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "Unknown error";
    console.error("[public/quote/pay] order create failed:", m);
    return NextResponse.json({ error: "Could not start payment. Please retry." }, { status: 500 });
  }
}
