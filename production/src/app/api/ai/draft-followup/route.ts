/**
 * POST /api/ai/draft-followup
 *
 * AI auto-draft (Roadmap Step 1) — drafts a short message for a LEAD or a
 * CUSTOMER (WhatsApp or email). ZERO money-write: it only returns editable
 * text; the operator reviews + sends via the existing WhatsApp/email actions.
 *
 * Two modes (exactly one of leadId / customerId):
 *   - leadId   → sales follow-up to a prospect (purpose 'followup')
 *   - customerId → either a warm check-in ('followup') or a polite payment
 *                  reminder ('reminder') for an existing customer.
 *
 * MONEY-HONESTY: when a money figure (outstanding balance) is relevant we pass
 * the REAL number in context and instruct the model to use it verbatim and
 * never invent/alter figures. The operator still edits before sending
 * (human-in-the-loop) — the draft is never sent automatically.
 *
 * Tenant-safe: the lead/customer is fetched via the operator's SESSION client
 * (RLS), so a user can only draft for their own tenant's records. Uses Gemini
 * Flash with a stub fallback (works even before GEMINI_API_KEY is set).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rupee } from "@/lib/utils";

const bodySchema = z
  .object({
    leadId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
    purpose: z.enum(["followup", "reminder"]).default("followup"),
  })
  .refine((d) => !!d.leadId !== !!d.customerId, {
    message: "Provide exactly one of leadId or customerId.",
  });

interface Draft {
  subject: string;
  message: string;
}

async function draftWithGemini(channel: "whatsapp" | "email", intent: string, ctx: string): Promise<Draft | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
  if (!apiKey || apiKey === "..." || apiKey.length < 10) return null;

  const system =
    "You are the assistant for an Indian cloud-software reseller (Google Workspace, " +
    "Microsoft 365, Zoho). " +
    intent +
    " " +
    (channel === "whatsapp"
      ? "Channel = WhatsApp: 2-4 short lines, friendly, Hinglish is fine, no greeting-heavy formality, end with a soft question/CTA. Leave subject empty."
      : "Channel = Email: a concise professional email with a clear subject line. Indian SME tone.") +
    " CRITICAL: never invent or change any amount, price, discount, date, or claim — use ONLY the figures given in context, verbatim. " +
    'Return ONLY JSON: {"subject": string, "message": string}.';
  const user = `Context:\n${ctx}\n\nDraft the ${channel} message now.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        }),
      },
    );
    if (!res.ok) {
      console.error("[ai/draft-followup] Gemini failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const p = JSON.parse(cleaned) as Partial<Draft>;
    if (!p.message) return null;
    return { subject: (p.subject ?? "").toString(), message: p.message.toString() };
  } catch (err) {
    console.error("[ai/draft-followup] Gemini crashed:", err);
    return null;
  }
}

/** Deterministic fallback so the feature works before GEMINI_API_KEY is set. */
function stubDraft(args: {
  channel: "whatsapp" | "email"; firstName: string; company: string;
  planLabel: string; purpose: "followup" | "reminder"; outstanding: number;
}): Draft {
  const { channel, firstName, company, planLabel, purpose, outstanding } = args;

  if (purpose === "reminder") {
    const amt = rupee(outstanding);
    if (channel === "whatsapp") {
      return {
        subject: "",
        message: `Hi ${firstName}, gentle reminder — there's an outstanding balance of ${amt} on your account with us. ` +
          `Happy to share a payment link or answer any questions. Thank you!`,
      };
    }
    return {
      subject: `Payment reminder — ${company}`,
      message: `Hi ${firstName},\n\nA gentle reminder that there's an outstanding balance of ${amt} on your account. ` +
        `Do let me know if you'd like a payment link or have any questions.\n\nThanks,\nExcel Technologies`,
    };
  }

  // followup / check-in
  if (channel === "whatsapp") {
    return {
      subject: "",
      message: `Hi ${firstName}, just checking in on ${planLabel} for ${company}. ` +
        `Everything running smoothly? Happy to help with anything — when's a good time for a quick call?`,
    };
  }
  return {
    subject: `Checking in — ${company}`,
    message: `Hi ${firstName},\n\nJust checking in on ${planLabel} for ${company}. ` +
      `Is everything running smoothly? I'd be glad to help with seats, renewals, or anything else.\n\n` +
      `Is there a good time this week for a quick call?\n\nThanks,\nExcel Technologies`,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // ── Lead mode ───────────────────────────────────────────────────────────
  if (parsed.leadId) {
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, company, contact_name, plan, seats, value, stage, notes, follow_up_date")
      .eq("id", parsed.leadId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    const ctx = [
      `Recipient is a SALES PROSPECT (not yet a customer).`,
      `Company: ${lead.company}`,
      lead.contact_name ? `Contact: ${lead.contact_name}` : null,
      lead.plan ? `Interested in: ${lead.plan}` : null,
      lead.seats ? `Seats: ${lead.seats}` : null,
      lead.value ? `Est. value: ${rupee(lead.value)}` : null,
      `Stage: ${lead.stage}`,
      lead.notes ? `Notes: ${lead.notes.slice(0, 600)}` : null,
    ].filter(Boolean).join("\n");

    const intent = "Draft a SHORT, warm, professional sales follow-up to a prospect. Reference what we know about them.";
    const ai = await draftWithGemini(parsed.channel, intent, ctx);
    const draft = ai ?? stubDraft({
      channel: parsed.channel,
      firstName: (lead.contact_name || lead.company).split(/\s+/)[0],
      company: lead.company,
      planLabel: lead.plan ? lead.plan.replace(/^google-workspace-/, "Google Workspace ") : "the plan we discussed",
      purpose: "followup",
      outstanding: 0,
    });
    return NextResponse.json({ ...draft, mode: ai ? "gemini" : "stub" });
  }

  // ── Customer mode ─────────────────────────────────────────────────────────
  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .select("id, name, contact_name, contact_email, contact_phone")
    .eq("id", parsed.customerId!)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  // Real subscription context (RLS-scoped) — outstanding + plan for the draft.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("plan, status, outstanding_amount")
    .eq("customer_id", customer.id);
  const outstanding = (subs ?? []).reduce((s, x) => s + (x.outstanding_amount ?? 0), 0);
  const activePlan = (subs ?? []).find((s) => s.status === "active")?.plan ?? (subs ?? [])[0]?.plan ?? null;
  const planLabel = activePlan ? activePlan.replace(/^google-workspace-/, "Google Workspace ") : "your subscription";

  const ctx = [
    `Recipient is an EXISTING CUSTOMER.`,
    `Company: ${customer.name}`,
    customer.contact_name ? `Contact: ${customer.contact_name}` : null,
    activePlan ? `Subscription: ${activePlan}` : null,
    parsed.purpose === "reminder" ? `Outstanding balance (use EXACTLY this, do not change): ${rupee(outstanding)}` : null,
  ].filter(Boolean).join("\n");

  const intent = parsed.purpose === "reminder"
    ? "Draft a SHORT, polite, warm PAYMENT REMINDER. State the exact outstanding amount given, offer help/a payment link, and keep it friendly (not aggressive)."
    : "Draft a SHORT, warm relationship CHECK-IN with an existing customer. No selling pressure; offer help with seats/renewals/support.";

  const ai = await draftWithGemini(parsed.channel, intent, ctx);
  const draft = ai ?? stubDraft({
    channel: parsed.channel,
    firstName: (customer.contact_name || customer.name).split(/\s+/)[0],
    company: customer.name,
    planLabel,
    purpose: parsed.purpose,
    outstanding,
  });
  return NextResponse.json({ ...draft, mode: ai ? "gemini" : "stub" });
}
