/**
 * Manual "Send now" override for a single subscription's renewal email.
 *
 * Used by the Renewals page row action ("Send now"). Differs from the daily
 * cron in three ways:
 *
 *   1. Tenant-scoped — authenticates with the user's session cookie, then
 *      checks the target subscription belongs to that tenant. No CRON_SECRET.
 *   2. Single subscription — body { subscription_id } picks one row.
 *   3. Force-send — even between cadence triggers, picks the most-recent
 *      applicable tone from CADENCE_TRIGGERS (or 'grace' if past renewal)
 *      and re-sends. Useful when a customer says "I didn't get the email"
 *      or operator wants to nudge ahead of schedule.
 *
 * Body: { subscription_id: string }
 * Returns: { status, providerId?, errorMessage?, step, daysUntil }
 *
 * Suspend/renewed states are NOT force-sendable — caller gets a friendly
 * error explaining why.
 */

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  CADENCE_TRIGGERS,
  decideCadence,
  type CadenceTone,
} from "@/lib/renewals/cadence";
import { renderTemplate } from "@/lib/renewals/templates";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { renderQuotePDF } from "@/lib/pdf";
import type { QuoteLineItem } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  // ── Authn ────────────────────────────────────────────────────────
  const userClient = createClient();
  const { data: authData } = await userClient.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Body
  let body: { subscription_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  if (!body.subscription_id) {
    return NextResponse.json({ error: "subscription_id required" }, { status: 400 });
  }

  // Resolve tenant_id from auth user
  const { data: me, error: meErr } = await userClient
    .from("users")
    .select("tenant_id")
    .eq("id", authData.user.id)
    .single();
  if (meErr || !me) {
    return NextResponse.json({ error: "user not linked to a tenant" }, { status: 403 });
  }

  // Admin client for the cross-table reads/writes (RLS would already protect,
  // but service role keeps the logic identical to the cron path).
  const supabase = createAdminClient();

  // ── Load subscription + verify tenant ownership ─────────────────
  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select(
      `id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr,
       renewal_date, status, renewal_state, reminder_count, renewal_quote_id`
    )
    .eq("id", body.subscription_id)
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ error: "subscription not found" }, { status: 404 });
  }
  if (sub.tenant_id !== me.tenant_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!sub.renewal_date) {
    return NextResponse.json({ error: "subscription has no renewal_date" }, { status: 400 });
  }
  if (sub.renewal_state === "suspended" || sub.renewal_state === "renewed") {
    return NextResponse.json(
      { error: `cannot send — subscription is ${sub.renewal_state}` },
      { status: 400 }
    );
  }

  // ── Tenant + customer info ──────────────────────────────────────
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, email, phone, gstin, address, grace_period_days")
    .eq("id", sub.tenant_id)
    .single();
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }

  const { data: customer } = sub.customer_id
    ? await supabase
        .from("customers")
        .select("name, contact_name, contact_email, gstin, contact_phone")
        .eq("id", sub.customer_id)
        .single()
    : { data: null };

  // ── Decide cadence; if off-trigger, pick closest tone ───────────
  const decision = decideCadence({
    renewalDate:  sub.renewal_date,
    graceDays:    tenant.grace_period_days ?? 0,
    currentState: (sub.renewal_state ?? "pending") as never,
  });

  // Pick effective tone for the manual send:
  //   - On a trigger / past-renewal: use decision.tone directly
  //   - Otherwise: pick the most-imminent upcoming trigger (smallest daysOut >= today's daysUntil)
  let tone: CadenceTone | null = decision.tone;
  if (!tone) {
    const daysUntil = decision.daysUntilRenewal;
    if (daysUntil < 0) {
      tone = "grace";
    } else {
      // Find the next trigger whose daysOut <= current daysUntil (sorted desc by daysOut)
      const candidates = [...CADENCE_TRIGGERS].sort((a, b) => b.daysOut - a.daysOut);
      const match = candidates.find((t) => t.daysOut <= daysUntil) ?? candidates[candidates.length - 1];
      tone = match?.tone ?? "soft";
    }
  }
  const step = decision.targetState === "pending" ? "notice_sent" : decision.targetState;

  // ── Ensure renewal quote exists (mirror cron path) ──────────────
  let renewalQuoteId = sub.renewal_quote_id;
  let renewalQuote: { amount: number; subtotal?: number; line_items?: QuoteLineItem[]; discount_pct?: number; tax_rate?: number } | null = null;
  let lineItems: QuoteLineItem[] = [];

  if (!renewalQuoteId) {
    const { data: nextNumber } = await supabase.rpc("next_document_number", {
      p_doc_type:  "quote",
      p_tenant_id: sub.tenant_id,
    });
    const newQuoteId = nextNumber as unknown as string;
    if (newQuoteId) {
      const annualAmount = (sub.mrr ?? 0) * 12;
      lineItems = [{
        id:        "renewal-1",
        name:      sub.plan,
        qty:       sub.seats,
        rate:      Math.round(annualAmount / Math.max(1, sub.seats)),
        cost:      Math.round((annualAmount * 0.83) / Math.max(1, sub.seats)),
        commitment:"annual_yearly",
      }];
      const renewalAt = new Date(sub.renewal_date);
      const validUntil = new Date(renewalAt.getTime() + (tenant.grace_period_days ?? 0) * 86400000);
      await supabase.from("quotes").insert({
        id:            newQuoteId,
        tenant_id:     sub.tenant_id,
        customer_id:   sub.customer_id,
        customer_name: sub.customer_name,
        plan:          sub.plan,
        seats:         sub.seats,
        amount:        annualAmount,
        status:        "sent",
        payment_status:"awaiting",
        owner_id:      null,
        created_date:  new Date().toISOString().slice(0, 10),
        expires_date:  validUntil.toISOString().slice(0, 10),
        line_items:    lineItems,
        subtotal:      annualAmount,
        total_cost:    Math.round(annualAmount * 0.83),
        discount_pct:  0,
        tax_rate:      18,
        notes:         `Renewal quote for subscription ${sub.id}`,
      });
      renewalQuoteId = newQuoteId;
      renewalQuote = { amount: annualAmount, line_items: lineItems };
      await supabase
        .from("subscriptions")
        .update({ renewal_quote_id: newQuoteId })
        .eq("id", sub.id);
    }
  }
  if (renewalQuoteId && !renewalQuote) {
    const { data: q } = await supabase
      .from("quotes")
      .select("id, amount, line_items, subtotal, discount_pct, tax_rate, expires_date, created_at")
      .eq("id", renewalQuoteId)
      .single();
    if (q) {
      renewalQuote = q as never;
      lineItems = (q.line_items ?? []) as QuoteLineItem[];
    }
  }

  // ── Recipient ───────────────────────────────────────────────────
  const recipient = customer?.contact_email;
  if (!recipient) {
    await supabase.from("renewal_email_log").insert({
      tenant_id:       sub.tenant_id,
      subscription_id: sub.id,
      cadence_step:    step,
      recipient_email: "(missing)",
      subject:         "(skipped — manual)",
      status:          "skipped",
      error_message:   "Customer has no contact_email on file",
    });
    return NextResponse.json(
      { error: "customer has no contact_email — add one and retry" },
      { status: 400 }
    );
  }

  // ── Render template ─────────────────────────────────────────────
  const tpl = renderTemplate(tone, {
    customerName:    customer?.contact_name || customer?.name || sub.customer_name,
    customerCompany: customer?.name,
    tenantName:      tenant.name,
    tenantEmail:     tenant.email,
    tenantPhone:     tenant.phone,
    planName:        sub.plan,
    seats:           sub.seats,
    amount:          renewalQuote?.amount ?? (sub.mrr ?? 0) * 12,
    renewalDate:     new Date(sub.renewal_date).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    }),
    daysUntil:       Math.abs(decision.daysUntilRenewal),
    graceDays:       tenant.grace_period_days ?? 0,
    acceptLink:      renewalQuoteId ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/quote/${renewalQuoteId}/accept` : undefined,
  });

  // ── PDF attachment ──────────────────────────────────────────────
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  if (renewalQuote && lineItems.length > 0) {
    try {
      const blob = await renderQuotePDF({
        tenantName:    tenant.name,
        tenantGstin:   tenant.gstin,
        tenantEmail:   tenant.email,
        tenantPhone:   tenant.phone,
        tenantAddress: tenant.address,
        quoteId:       renewalQuoteId!,
        customerName:  sub.customer_name,
        contactName:   customer?.contact_name ?? null,
        contactEmail:  customer?.contact_email ?? null,
        contactPhone:  customer?.contact_phone ?? null,
        lineItems,
        subtotal:      renewalQuote.subtotal ?? renewalQuote.amount,
        discountPct:   renewalQuote.discount_pct ?? 0,
        discount:      0,
        taxable:       renewalQuote.subtotal ?? renewalQuote.amount,
        taxRate:       renewalQuote.tax_rate ?? 18,
        tax:           Math.round((renewalQuote.subtotal ?? renewalQuote.amount) * 0.18),
        total:         renewalQuote.amount,
        interState:    false,
        validityDays:  30,
        notes:         "Renewal quote. Reply or call us with any questions.",
      });
      const arrBuf = await blob.arrayBuffer();
      attachments = [{
        filename:    `Renewal-${renewalQuoteId}.pdf`,
        content:     Buffer.from(arrBuf),
        contentType: "application/pdf",
      }];
    } catch (pdfErr) {
      // Non-fatal — send without attachment
      // eslint-disable-next-line no-console
      console.warn(`[send-now] PDF render failed for ${sub.id}:`, (pdfErr as Error).message);
    }
  }

  // ── Send ────────────────────────────────────────────────────────
  const sendResult = await sendEmail({
    to:      recipient,
    subject: tpl.subject,
    text:    tpl.body,
    from:    tenant.email ?? undefined,
    replyTo: tenant.email ?? undefined,
    attachments,
  });

  // ── Log + update sub ────────────────────────────────────────────
  await supabase.from("renewal_email_log").insert({
    tenant_id:       sub.tenant_id,
    subscription_id: sub.id,
    cadence_step:    step,
    recipient_email: recipient,
    subject:         tpl.subject,
    status:          sendResult.status,
    provider_id:     sendResult.providerId,
    error_message:   sendResult.errorMessage,
  });

  if (sendResult.status === "sent" || sendResult.status === "stubbed") {
    await supabase
      .from("subscriptions")
      .update({
        renewal_state:           step,
        reminder_count:          (sub.reminder_count ?? 0) + 1,
        last_reminder_sent_at_v2: new Date().toISOString(),
      })
      .eq("id", sub.id);
  }

  return NextResponse.json({
    status:       sendResult.status,
    email_mode:   isEmailConfigured() ? "real" : "stub",
    providerId:   sendResult.providerId,
    errorMessage: sendResult.errorMessage,
    step,
    tone,
    daysUntil:    decision.daysUntilRenewal,
  });
}
