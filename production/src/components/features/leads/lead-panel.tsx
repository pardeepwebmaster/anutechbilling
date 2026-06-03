"use client";

/**
 * LeadPanel — right-hand detail pane for the Leads master-detail (list) view.
 * Takes a Lead object (the list already has it in memory, so no extra fetch).
 * Mirrors the Customers CustomerPanel pattern: identity + quick actions + meta
 * + notes, with a close (X) to return the list to full-width.
 */
import * as React from "react";
import type { Lead } from "@/lib/supabase/database.types";
import { rupee, formatDate, initials, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const STAGE_META: Record<string, { label: string; color: "slate" | "indigo" | "amber" | "emerald" | "rose" }> = {
  new:     { label: "New",        color: "slate" },
  contact: { label: "Contacted",  color: "indigo" },
  demo:    { label: "Demo done",  color: "indigo" },
  trial:   { label: "Trial",      color: "amber" },
  quote:   { label: "Quote sent", color: "amber" },
  won:     { label: "Won",        color: "emerald" },
  lost:    { label: "Lost",       color: "rose" },
};

export function LeadPanel({ lead, onClose }: { lead: Lead; onClose?: () => void }) {
  const stage = STAGE_META[lead.stage] ?? STAGE_META.new;
  const phone = lead.contact_phone?.replace(/\s+/g, "");

  // ── AI follow-up draft (Roadmap Step 1 — zero money-write) ──────────────
  const [channel, setChannel] = React.useState<"whatsapp" | "email">("whatsapp");
  const [draft, setDraft] = React.useState<{ subject: string; message: string; mode: string } | null>(null);
  const [drafting, setDrafting] = React.useState(false);

  // Reset the draft when the selected lead changes.
  React.useEffect(() => { setDraft(null); setDrafting(false); }, [lead.id]);

  async function generate(ch: "whatsapp" | "email") {
    setChannel(ch);
    setDrafting(true);
    setDraft(null);
    try {
      const res = await fetch("/api/ai/draft-followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, channel: ch }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Couldn't draft."); return; }
      setDraft({ subject: data.subject ?? "", message: data.message ?? "", mode: data.mode ?? "stub" });
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setDrafting(false);
    }
  }

  const sendLink = draft
    ? channel === "whatsapp" && phone
      ? `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(draft.message)}`
      : channel === "email" && lead.contact_email
        ? `mailto:${lead.contact_email}?subject=${encodeURIComponent(draft.subject || `Following up — ${lead.company}`)}&body=${encodeURIComponent(draft.message)}`
        : null
    : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={initials(lead.company) || "?"} color="amber" size="md" />
          <div className="min-w-0">
            <h2 className="font-serif text-2xl text-ink leading-tight truncate">{lead.company}</h2>
            <div className="mt-1"><Badge color={stage.color} dot>{stage.label}</Badge></div>
          </div>
        </div>
        {onClose && <IconButton icon="x" aria-label="Close" onClick={onClose} />}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mb-6">
          {phone && (
            <Button asChild size="sm" variant="primary">
              <a href={`tel:${phone}`}><Icon name="phone" size={13} className="mr-1.5" />Call</a>
            </Button>
          )}
          {phone && (
            <Button asChild size="sm" variant="default">
              <a href={`https://wa.me/${phone.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer">
                <Icon name="whatsapp" size={13} className="mr-1.5" />WhatsApp
              </a>
            </Button>
          )}
          {lead.contact_email && (
            <Button asChild size="sm" variant="default">
              <a href={`mailto:${lead.contact_email}`}><Icon name="mail" size={13} className="mr-1.5" />Email</a>
            </Button>
          )}
        </div>

        {/* AI follow-up draft (Step 1 — zero money-write) */}
        <div className="mb-6 border border-hairline rounded-lg p-3 bg-paper-2/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold inline-flex items-center gap-1.5">
              <Icon name="sparkles" size={12} className="text-amber" /> Draft follow-up
            </span>
            <div className="flex gap-1">
              {(["whatsapp", "email"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => generate(ch)}
                  disabled={drafting}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber",
                    channel === ch && draft ? "bg-amber text-white border-amber/0" : "bg-paper border-hairline text-ink-2 hover:bg-paper-2",
                  )}
                >
                  {ch === "whatsapp" ? "WhatsApp" : "Email"}
                </button>
              ))}
            </div>
          </div>
          {drafting && <div className="text-xs text-ink-3 py-2">Drafting…</div>}
          {draft && !drafting && (
            <>
              <Textarea
                rows={channel === "email" ? 6 : 3}
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              />
              <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                <span className="text-[10px] text-ink-3">
                  {draft.mode === "gemini" ? "AI draft · edit before sending" : "Template · set GEMINI_API_KEY for real AI"}
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="default" onClick={() => { navigator.clipboard?.writeText(draft.message); toast.success("Copied"); }}>
                    Copy
                  </Button>
                  {sendLink && (
                    <Button asChild size="sm" variant="primary">
                      <a href={sendLink} target="_blank" rel="noopener noreferrer">
                        <Icon name={channel === "whatsapp" ? "whatsapp" : "mail"} size={13} className="mr-1.5" />
                        Send
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
          {!draft && !drafting && (
            <p className="text-[11px] text-ink-3">WhatsApp ya Email choose karo — AI ek follow-up draft banayega jise aap edit karke bhej sako.</p>
          )}
        </div>

        {/* Details — only fields that actually have a value (no "—" walls).
            A thin lead shows a friendly nudge instead of a grid of dashes. */}
        {(() => {
          const fields: { label: string; value: string | null; mono?: boolean }[] = [
            { label: "Contact",   value: lead.contact_name },
            { label: "Email",     value: lead.contact_email, mono: true },
            { label: "Phone",     value: lead.contact_phone, mono: true },
            { label: "Plan",      value: lead.plan },
            { label: "Seats",     value: lead.seats != null ? String(lead.seats) : null },
            { label: "Value",     value: lead.value ? rupee(lead.value) : null },
            { label: "Follow-up", value: lead.follow_up_date ? formatDate(lead.follow_up_date) : null },
          ].filter((f) => f.value);
          const thin = !lead.contact_email && !lead.contact_phone && !lead.plan && !lead.value;
          return (
            <>
              {thin && (
                <div className="mb-5 rounded-lg border border-amber/30 bg-amber-soft/40 p-3 text-xs text-amber-ink leading-relaxed">
                  Is lead mein abhi zyada detail nahi hai. Contact, plan ya value add karke isse actionable banao —
                  phir AI follow-up + quote bhej sakte ho.
                </div>
              )}
              {fields.length > 0 && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 mb-5">
                  {fields.map((f) => (
                    <div key={f.label}>
                      <dt className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-0.5">{f.label}</dt>
                      <dd className={cn("text-sm text-ink", f.mono && "font-mono")}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          );
        })()}

        {/* Notes */}
        {lead.notes && (
          <div className="mb-5">
            <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1.5">Notes</div>
            <div className="text-sm text-ink-2 whitespace-pre-wrap bg-paper-2/40 border border-hairline rounded-md p-3">
              {lead.notes}
            </div>
          </div>
        )}

        {/* Activity — lightweight, keeps the panel feeling alive */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Activity</div>
          <ul className="space-y-3">
            {lead.follow_up_date && (
              <ActivityRow icon="clock" color="text-amber-ink" title="Follow-up scheduled" time={formatDate(lead.follow_up_date)} />
            )}
            <ActivityRow icon="target" color="text-indigo" title={`Stage · ${stage.label}`} />
            {lead.source && <ActivityRow icon="inbox" color="text-ink-3" title={`Source · ${lead.source}`} />}
            {lead.created_at && (
              <ActivityRow icon="plus" color="text-ink-3" title="Lead created" time={formatDate(lead.created_at.slice(0, 10))} />
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ icon, color, title, time }: { icon: string; color: string; title: string; time?: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon name={icon} size={14} className={cn("mt-0.5 flex-shrink-0", color)} />
      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-2">{title}</span>
        {time ? <span className="text-[11px] text-ink-3 flex-shrink-0">{time}</span> : null}
      </div>
    </li>
  );
}
