/**
 * Trial expiry cron — runs daily.
 *
 * For every lead at stage='trial' whose trial_expires_at <= today AND
 * trial_converted_at is NULL AND trial_expired_at is NULL:
 *   1. Mark trial_expired_at = now()
 *   2. Stage stays 'trial' (NOT auto-moved to 'lost') — operator decides
 *      whether to push for last-ditch conversion or close the deal out.
 *      Rationale: many trials convert on day 15-17 after a final call.
 *   3. Send "we miss you" email to customer + alert to Pardeep
 *
 * Schedule: 10:00 IST (04:30 UTC) — daily, after the renewals cron.
 * Configure via vercel.json or your scheduler of choice.
 *
 * Auth: Same Bearer-token pattern as the renewals cron. Set CRON_SECRET
 * in env. In dev without the secret, route is open.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PARDEEP_EMAIL = "Pardeep@exceltechnologies.in";
const FROM_EMAIL    = process.env.RESEND_FROM_DEFAULT?.trim() || "ResellerOS <onboarding@resend.dev>";
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://resellersos.web.app";

interface CronResult {
  ran_at:         string;
  total_expired:  number;
  emails_sent:    number;
  errors:         { lead_id: string; message: string }[];
  details:        { lead_id: string; company: string; days_past: number }[];
}

function checkAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null; // dev mode — allow
  const header = req.headers.get("authorization") ?? "";
  const match  = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || match[1] !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  const auth = checkAuth(req);
  if (auth) return auth;

  const admin = createAdminClient();
  const today = new Date();
  const result: CronResult = {
    ran_at:        today.toISOString(),
    total_expired: 0,
    emails_sent:   0,
    errors:        [],
    details:       [],
  };

  // Pull trials past their expiry that haven't been marked yet
  const { data: leads, error } = await admin
    .from("leads")
    .select("id, tenant_id, company, contact_name, contact_email, contact_phone, plan, domain, trial_expires_at, trial_started_at")
    .eq("stage", "trial")
    .is("trial_converted_at", null)
    .is("trial_expired_at", null)
    .lte("trial_expires_at", today.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const lead of leads ?? []) {
    try {
      // Stamp expiry
      const { error: updErr } = await admin
        .from("leads")
        .update({ trial_expired_at: today.toISOString() })
        .eq("id", lead.id);
      if (updErr) throw updErr;

      result.total_expired++;
      const expiresAt = new Date(lead.trial_expires_at ?? today);
      const daysPast  = Math.round((today.getTime() - expiresAt.getTime()) / 86400000);
      result.details.push({
        lead_id:   lead.id,
        company:   lead.company,
        days_past: daysPast,
      });

      // Best-effort emails — don't fail the cron if these break
      if (lead.contact_email) {
        try {
          await sendEmail({
            to:      lead.contact_email,
            from:    FROM_EMAIL,
            replyTo: PARDEEP_EMAIL,
            subject: `Your Google Workspace trial — ${lead.domain ?? "your domain"} — has ended`,
            text:
`Hi ${(lead.contact_name ?? "").split(" ")[0] || "there"},

Your 14-day Google Workspace trial on ${lead.domain ?? "your domain"} ended ${daysPast === 0 ? "today" : `${daysPast} days ago`}.

We hope it gave you a real feel for how it would work day-to-day. We'd love to
know how it went — and if you'd like to convert to a paid plan, we can pick up
right where you left off (no data loss, just billing kicks in).

Reply to this email or WhatsApp Pardeep on +91 99999 30300 — he'll get you
sorted in under 30 minutes.

— Pardeep Sharma
   Founder, Excel Technologies
   Google Premier Partner · since 2014`,
          });
          result.emails_sent++;
        } catch (e) {
          console.error("[trial-expiry] customer email failed:", e);
        }
      }

      try {
        await sendEmail({
          to:      PARDEEP_EMAIL,
          from:    FROM_EMAIL,
          subject: `⏰ Trial expired: ${lead.company} (${lead.domain ?? "no domain"}) — last chance`,
          text:
`A 14-day trial just ended.

COMPANY      ${lead.company}
CONTACT      ${lead.contact_name ?? "—"} <${lead.contact_email ?? "—"}>
PHONE        ${lead.contact_phone ?? "—"}
PLAN         ${lead.plan ?? "—"}
DOMAIN       ${lead.domain ?? "—"}
STARTED      ${lead.trial_started_at ? new Date(lead.trial_started_at).toDateString() : "—"}
EXPIRED      ${new Date(lead.trial_expires_at ?? today).toDateString()} (${daysPast} days ago)

A "we miss you" email has been sent to the customer. Customer responses
in the next 3-5 days still often convert — call them if they don't reply.

Open the lead:
${APP_URL}/leads?lead=${lead.id}

— ResellerOS`,
        });
        result.emails_sent++;
      } catch (e) {
        console.error("[trial-expiry] pardeep alert failed:", e);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push({ lead_id: lead.id, message: msg });
    }
  }

  return NextResponse.json(result);
}
