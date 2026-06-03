/**
 * POST /api/ai/draft-followup
 *
 * AI auto-draft (Roadmap Step 1) — drafts a short follow-up message for a lead
 * (WhatsApp or email). ZERO money-write: it only returns editable text; the
 * operator reviews + sends via the existing WhatsApp/email actions.
 *
 * Tenant-safe: the lead is fetched via the operator's SESSION client (RLS), so
 * a user can only draft for their own tenant's leads. Uses Gemini Flash with a
 * stub fallback (works even before GEMINI_API_KEY is set — proves the flow).
 *
 * Mirrors the existing Gemini pattern in /api/campaigns/ai-generate.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  leadId: z.string().min(1),
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
});

interface Draft {
  subject: string;
  message: string;
}

async function draftWithGemini(channel: "whatsapp" | "email", ctx: string): Promise<Draft | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
  if (!apiKey || apiKey === "..." || apiKey.length < 10) return null;

  const system =
    "You are the sales assistant for an Indian cloud-software reseller (Google Workspace, " +
    "Microsoft 365, Zoho). Draft a SHORT, warm, professional follow-up to a prospect. " +
    (channel === "whatsapp"
      ? "Channel = WhatsApp: 2-4 short lines, friendly, Hinglish is fine, no greeting-heavy formality, end with a soft question/CTA. No subject needed (leave subject empty)."
      : "Channel = Email: a concise professional email with a clear subject line. Indian SME tone.") +
    " Never invent prices, discounts, or claims not given. Reference what we know about them. " +
    'Return ONLY JSON: {"subject": string, "message": string}.';
  const user = `What we know about this lead:\n${ctx}\n\nDraft the ${channel} follow-up now.`;

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
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
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
function stubDraft(channel: "whatsapp" | "email", lead: {
  company: string; contact_name: string | null; plan: string | null;
}): Draft {
  const first = (lead.contact_name || lead.company).split(/\s+/)[0];
  const plan = lead.plan ? lead.plan.replace(/^google-workspace-/, "Google Workspace ") : "the plan we discussed";
  if (channel === "whatsapp") {
    return {
      subject: "",
      message: `Hi ${first}, just following up on ${plan} for ${lead.company}. ` +
        `Happy to share a GST quote or answer any questions — when's a good time for a quick call?`,
    };
  }
  return {
    subject: `Following up — ${lead.company}`,
    message: `Hi ${first},\n\nJust checking in on ${plan} for ${lead.company}. ` +
      `I'd be glad to send across a GST-compliant quote and walk you through setup/migration.\n\n` +
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

  // RLS scopes this to the operator's own tenant.
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, company, contact_name, plan, seats, value, stage, notes, follow_up_date")
    .eq("id", parsed.leadId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const ctx = [
    `Company: ${lead.company}`,
    lead.contact_name ? `Contact: ${lead.contact_name}` : null,
    lead.plan ? `Interested in: ${lead.plan}` : null,
    lead.seats ? `Seats: ${lead.seats}` : null,
    lead.value ? `Est. value: ₹${lead.value}` : null,
    `Stage: ${lead.stage}`,
    lead.notes ? `Notes: ${lead.notes.slice(0, 600)}` : null,
  ].filter(Boolean).join("\n");

  const ai = await draftWithGemini(parsed.channel, ctx);
  const draft = ai ?? stubDraft(parsed.channel, lead);

  return NextResponse.json({ ...draft, mode: ai ? "gemini" : "stub" });
}
