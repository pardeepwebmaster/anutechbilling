/**
 * Renewal automation cron — runs daily.
 *
 * Schedule: 09:00 IST (03:30 UTC) — set via vercel.json. Local dev can
 * trigger by hitting `curl http://localhost:3000/api/cron/renewals` with
 * Authorization: Bearer <CRON_SECRET>.
 *
 * What it does, for every active subscription with a renewal_date:
 *
 *   1. Compute today's cadence step (decideCadence).
 *   2. If a NEW step is triggered today:
 *        a. Auto-generate a renewal quote when entering 'notice_sent'
 *           (T-15) and the sub doesn't already have one.
 *        b. Render the appropriate tone template.
 *        c. Render the renewal Quote PDF as attachment.
 *        d. Send via lib/email/send.ts (real Resend if key configured;
 *           stub mode otherwise — both paths log to renewal_email_log).
 *   3. If shouldSuspend → flip status='paused' + stamp suspended_at +
 *      set renewal_state='suspended'.
 *   4. Update renewal_state + reminder_count + last_reminder_sent_at_v2.
 *
 * Auth: Vercel adds `Authorization: Bearer <CRON_SECRET>` to its cron
 * requests when CRON_SECRET env var is set. We accept that OR a manual
 * override matching the same secret. Without a secret env, the route
 * is open in dev — production should always set it.
 *
 * Idempotency: a given (subscription_id, cadence_step) pair only ever
 * gets one 'sent' / 'stubbed' row in renewal_email_log. Re-running the
 * cron the same day is a no-op for sends, but it WILL re-attempt
 * suspend if the previous run failed mid-flight.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { decideCadence } from "@/lib/renewals/cadence";
import { renderTemplate } from "@/lib/renewals/templates";
import { createOrGetRenewalQuote } from "@/lib/renewals/create-renewal-quote";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { renderQuotePDF } from "@/lib/pdf";
import { isInterStateSupply } from "@/lib/gst/place-of-supply";
import type { QuoteLineItem } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Body shape returned to the caller — useful for ad-hoc inspection. */
interface CronResult {
  ran_at:           string;
  email_mode:       "real" | "stub";
  total_active:     number;
  emails_sent:      number;
  emails_skipped:   number;
  suspends:         number;
  /** RN-24: subscriptions lapsed to 'expired' because they're not renewing and the term ended. */
  lapsed:           number;
  errors:           { subscription_id: string; message: string }[];
  details:          { subscription_id: string; customer: string; step: string; daysUntil: number; emailStatus?: string }[];
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<NextResponse<CronResult | { error: string }>> {
  // ── Auth check ───────────────────────────────────────────────────
  const expected = process.env.CRON_SECRET?.trim();
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    const provided = auth.replace(/^Bearer\s+/i, "").trim();
    if (provided !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();  // service role — bypasses RLS for the cron
  const result: CronResult = {
    ran_at:        new Date().toISOString(),
    email_mode:    isEmailConfigured() ? "real" : "stub",
    total_active:  0,
    emails_sent:   0,
    emails_skipped:0,
    suspends:      0,
    lapsed:        0,
    errors:        [],
    details:       [],
  };

  // ── RN-24: lapse NON-renewing subscriptions whose paid term has ended ──
  // auto_renew=false subs are skipped by the renewal cadence below, so without
  // this they'd sit 'active' forever past their renewal_date. Once the term has
  // ended (renewal_date strictly in the past) and the customer/operator chose
  // not to renew, the subscription lapses to 'expired'. Idempotent (only touches
  // 'active' rows) and non-destructive — a later renewal payment still revives
  // it via record_payment's roll-forward (which sets status='active').
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: lapsedRows, error: lapseErr } = await supabase
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .eq("auto_renew", false)
    .lt("renewal_date", todayIso)
    .select("id");
  if (lapseErr) {
    result.errors.push({ subscription_id: "(lapse-step)", message: lapseErr.message });
  } else {
    result.lapsed = lapsedRows?.length ?? 0;
  }

  // ── Fetch all active subscriptions across tenants with a renewal_date ─
  // Filters out auto_renew=false — customer chose to let it expire.
  const { data: subs, error: subsErr } = await supabase
    .from("subscriptions")
    .select(`
      id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr,
      renewal_date, status, renewal_state, reminder_count, renewal_quote_id
    `)
    .eq("status", "active")
    .eq("auto_renew", true)
    .not("renewal_date", "is", null);

  if (subsErr) {
    return NextResponse.json({ error: `subs fetch failed: ${subsErr.message}` }, { status: 500 });
  }
  result.total_active = subs?.length ?? 0;

  for (const sub of subs ?? []) {
    try {
      // ── Per-tenant info: grace_period + tenant email (for from-address fallback) ──
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, email, phone, gstin, address, grace_period_days, state_code")
        .eq("id", sub.tenant_id)
        .single();
      if (!tenant) continue;

      // ── Per-customer info — need email to actually send ──
      const { data: customer } = sub.customer_id
        ? await supabase
            .from("customers")
            .select("name, contact_name, contact_email, gstin, contact_phone, state_code")
            .eq("id", sub.customer_id)
            .single()
        : { data: null };

      // Decide cadence
      const decision = decideCadence({
        renewalDate:  sub.renewal_date!,
        graceDays:    tenant.grace_period_days ?? 0,
        currentState: (sub.renewal_state ?? "pending") as any,
      });

      const detail = {
        subscription_id: sub.id,
        customer:        sub.customer_name,
        step:            decision.targetState,
        daysUntil:       decision.daysUntilRenewal,
        emailStatus:    undefined as string | undefined,
      };

      // ── Suspend path ─────────────────────────────────────────────
      if (decision.shouldSuspend) {
        await supabase
          .from("subscriptions")
          .update({
            status:        "paused",
            renewal_state: "suspended",
            suspended_at:  new Date().toISOString(),
          })
          .eq("id", sub.id);
        result.suspends += 1;
        detail.emailStatus = "(suspended)";
        result.details.push(detail);
        continue;
      }

      // ── Daily idempotency: did we already attempt this (sub,step) today? ──
      // Without this, a broken Resend key burns one API call per sub per day,
      // and re-runs (manual triggers, retries) duplicate-attempt every step.
      if (decision.shouldSendEmail) {
        const { count: attemptsToday } = await supabase
          .from("renewal_email_log")
          .select("id", { count: "exact", head: true })
          .eq("subscription_id", sub.id)
          .eq("cadence_step", decision.targetState)
          .gte("sent_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
        if ((attemptsToday ?? 0) > 0) {
          detail.emailStatus = "(already attempted today)";
          result.emails_skipped += 1;
          // Still sync renewal_state so UI reflects current cadence position
          if (sub.renewal_state !== decision.targetState) {
            await supabase
              .from("subscriptions")
              .update({ renewal_state: decision.targetState })
              .eq("id", sub.id);
          }
          result.details.push(detail);
          continue;
        }
      }

      // ── Email path ───────────────────────────────────────────────
      if (decision.shouldSendEmail && decision.tone) {
        // 1. Ensure renewal quote exists (only matters at T-15 entry)
        // Ensure renewal quote exists for ANY cadence step where we're emailing.
        // Helper is idempotent — returns the existing quote if one is linked.
        // Originally restricted to T-15 ('notice_sent'); that meant freshly
        // created subs or those whose renewal_date got edited could fire a
        // 'FINAL NOTICE' email at T-0 with no quote attached. Now we always
        // try to ensure a quote exists before sending.
        const quoteResult = await createOrGetRenewalQuote({
          supabase,
          subscriptionId:  sub.id,
          tenantId:        sub.tenant_id,
          customerId:      sub.customer_id,
          customerName:    sub.customer_name,
          plan:            sub.plan,
          seats:           sub.seats,
          mrr:             sub.mrr ?? 0,
          renewalDate:     sub.renewal_date!,
          graceDays:       tenant.grace_period_days ?? 0,
          existingQuoteId: sub.renewal_quote_id,
          notes:           `Auto-generated renewal quote for subscription ${sub.id}`,
        });

        const renewalQuoteId = quoteResult?.quoteId ?? null;
        const renewalQuote = quoteResult
          ? {
              amount:       quoteResult.amount,
              subtotal:     quoteResult.subtotal,
              discount_pct: quoteResult.discountPct,
              tax_rate:     quoteResult.taxRate,
            }
          : null;
        const lineItems: QuoteLineItem[] = quoteResult?.lineItems ?? [];

        // 2. Recipient — prefer customer.contact_email
        const recipient = customer?.contact_email;
        if (!recipient) {
          await supabase.from("renewal_email_log").insert({
            tenant_id:       sub.tenant_id,
            subscription_id: sub.id,
            cadence_step:    decision.targetState,
            recipient_email: "(missing)",
            subject:         "(skipped)",
            status:          "skipped",
            error_message:   "Customer has no contact_email on file",
          });
          result.emails_skipped += 1;
          detail.emailStatus = "skipped — no email";
          result.details.push(detail);
          continue;
        }

        // 3. Render template
        const tpl = renderTemplate(decision.tone, {
          customerName:    customer?.contact_name || customer?.name || sub.customer_name,
          customerCompany: customer?.name,
          tenantName:      tenant.name,
          tenantEmail:     tenant.email,
          tenantPhone:     tenant.phone,
          planName:        sub.plan,
          seats:           sub.seats,
          amount:          renewalQuote?.amount ?? (sub.mrr ?? 0) * 12,
          renewalDate:     new Date(sub.renewal_date!).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          }),
          daysUntil:       Math.abs(decision.daysUntilRenewal),
          graceDays:       tenant.grace_period_days ?? 0,
          acceptLink:      renewalQuoteId ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/quote/${renewalQuoteId}/accept` : undefined,
        });

        // 4. Render PDF attachment (only when we have a quote)
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
              interState:    isInterStateSupply(customer?.state_code, tenant.state_code),
              validityDays:  30,
              notes:         "Renewal quote — auto-generated. Reply or call us with any questions.",
              isRenewal:     true,
            });
            const arrBuf = await blob.arrayBuffer();
            attachments = [{
              filename:    `Renewal-${renewalQuoteId}.pdf`,
              content:     Buffer.from(arrBuf),
              contentType: "application/pdf",
            }];
          } catch (pdfErr) {
            // PDF gen failure shouldn't block the email — just send without attachment
            // and note in the audit log via error_message at end.
            // eslint-disable-next-line no-console
            console.warn(`[cron/renewals] PDF render failed for ${sub.id}:`, (pdfErr as Error).message);
          }
        }

        // 5. Send
        const sendResult = await sendEmail({
          to:      recipient,
          subject: tpl.subject,
          text:    tpl.body,
          from:    tenant.email ?? undefined,
          replyTo: tenant.email ?? undefined,
          attachments,
        });

        // 6. Log + update sub state
        await supabase.from("renewal_email_log").insert({
          tenant_id:       sub.tenant_id,
          subscription_id: sub.id,
          cadence_step:    decision.targetState,
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
              renewal_state:           decision.targetState,
              reminder_count:          (sub.reminder_count ?? 0) + 1,
              last_reminder_sent_at_v2: new Date().toISOString(),
            })
            .eq("id", sub.id);
          result.emails_sent += 1;
          detail.emailStatus = sendResult.status;
        } else {
          result.errors.push({ subscription_id: sub.id, message: sendResult.errorMessage ?? "send failed" });
          detail.emailStatus = `failed: ${sendResult.errorMessage}`;
        }

        result.details.push(detail);
        continue;
      }

      // ── No-op path: sync renewal_state if it drifted ─────────────
      // Guard against REGRESSING from terminal states:
      //   - 'renewed': sub was just paid for this cycle. decideCadence
      //     would return 'pending' for far-future renewal_dates, which
      //     would wipe the "just renewed" signal until next T-15.
      //   - 'suspended': sub was auto-suspended. Don't quietly revive it.
      // Both states must be cleared explicitly (operator action or new
      // renewal payment via record_payment).
      const isTerminalState =
        sub.renewal_state === "renewed" ||
        sub.renewal_state === "suspended";
      if (!isTerminalState && sub.renewal_state !== decision.targetState) {
        await supabase
          .from("subscriptions")
          .update({ renewal_state: decision.targetState })
          .eq("id", sub.id);
      }
      // Don't push to details unless something happened — keeps the result body small
    } catch (err) {
      result.errors.push({
        subscription_id: sub.id,
        message:         (err as Error).message,
      });
    }
  }

  return NextResponse.json(result);
}
