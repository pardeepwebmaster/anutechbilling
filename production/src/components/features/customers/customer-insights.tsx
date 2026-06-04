"use client";

/**
 * customer-insights — the single source of truth for the "world-class customer
 * view" shared by BOTH the master-detail CustomerPanel and the full /customers/[id]
 * 360 page. Keeping the money-derivation here (not duplicated per surface) means
 * the panel and the page can never drift and show a different Outstanding / MRR /
 * Lifetime figure — a real money-correctness hazard if it were copy-pasted.
 *
 * MONEY-HONESTY: every number comes from real rows. No fabricated data, no stub
 * activity. The Next-Best-Action is DETERMINISTIC (rules over real data, not AI)
 * so there is zero hallucination risk on money figures, and nothing here writes
 * money — reminders are plain WhatsApp/email deep-links.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import type { Customer, Subscription, Invoice, Quote } from "@/lib/supabase/database.types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, rupee, daysBetween, cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════
// Pure logic
// ════════════════════════════════════════════════════════════════════════
export type Nba = {
  tone: "danger" | "warning" | "info" | "success";
  icon: string;
  title: string;
  body: string;
  cta?: { label: string; kind: "draft" | "profile" | "quote"; channel?: "whatsapp" | "email"; purpose?: "followup" | "reminder" };
};

export type CustomerInsights = {
  activeSubs: Subscription[];
  totalMRR: number;
  seatsTotal: number;
  seatsUsed: number;
  outstanding: number;
  lifetimePaid: number;
  overdueCount: number;
  nearestRenewal?: string;
  renewalDays: number | null;
  nba: Nba;
};

/** Derive all customer KPIs + the next-best-action from real rows. */
export function deriveCustomerInsights(
  c: Customer,
  subs: Subscription[],
  invoices: Invoice[],
): CustomerInsights {
  const activeSubs = subs.filter((s) => s.status === "active");
  const totalMRR = activeSubs.reduce((s, x) => s + (x.mrr ?? 0), 0);
  const seatsTotal = activeSubs.reduce((s, x) => s + (x.seats ?? 0), 0);
  const seatsUsed = activeSubs.reduce((s, x) => s + (x.used ?? 0), 0);

  const outstanding = subs.reduce((s, x) => s + (x.outstanding_amount ?? 0), 0);
  const lifetimePaid = invoices.filter((i) => i.status === "paid").reduce((s, x) => s + (x.amount ?? 0), 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  const nearestRenewal = activeSubs
    .map((s) => s.renewal_date)
    .filter((d): d is string => !!d)
    .sort()[0];
  const renewalDays = nearestRenewal ? daysBetween(new Date(), nearestRenewal) : null;

  const firstName = (c.contact_name || c.name).split(/\s+/)[0];
  const phone = c.contact_phone?.replace(/\s+/g, "");

  const nba = computeNBA({ customer: c, firstName, phone, outstanding, overdueCount, renewalDays, subCount: subs.length });

  return { activeSubs, totalMRR, seatsTotal, seatsUsed, outstanding, lifetimePaid, overdueCount, nearestRenewal, renewalDays, nba };
}

function computeNBA(args: {
  customer: Customer; firstName: string; phone?: string;
  outstanding: number; overdueCount: number; renewalDays: number | null; subCount: number;
}): Nba {
  const { customer, firstName, phone, outstanding, overdueCount, renewalDays, subCount } = args;
  const canMessage = !!phone || !!customer.contact_email;
  const channel: "whatsapp" | "email" = phone ? "whatsapp" : "email";

  if (outstanding > 0 || overdueCount > 0) {
    return {
      tone: "danger",
      icon: "alert",
      title: `${rupee(outstanding)} outstanding${overdueCount > 0 ? ` · ${overdueCount} overdue invoice${overdueCount > 1 ? "s" : ""}` : ""}`,
      body: "Collect this before it ages further — let AI draft a friendly reminder you can edit and send.",
      cta: canMessage ? { label: "Draft reminder with AI", kind: "draft", channel, purpose: "reminder" } : undefined,
    };
  }

  if (renewalDays != null && renewalDays <= 30) {
    return {
      tone: "warning",
      icon: "refresh",
      title: renewalDays < 0 ? `Renewal ${-renewalDays} day(s) overdue` : `Renewal due in ${renewalDays} day(s)`,
      body: "Review the renewal quote and send it before service lapses.",
      cta: { label: "Create renewal quote", kind: "quote" },
    };
  }

  if (subCount === 0) {
    return {
      tone: "info",
      icon: "plus",
      title: "No subscription yet",
      body: `Send ${firstName} the first quote — turn this contact into recurring revenue.`,
      cta: { label: "Create first quote", kind: "quote" },
    };
  }

  return {
    tone: "success",
    icon: "check_circle",
    title: `${firstName} is in good shape`,
    body: "Nothing needs action right now. A periodic check-in keeps the relationship warm.",
    cta: canMessage ? { label: "Draft a check-in with AI", kind: "draft", channel, purpose: "followup" } : undefined,
  };
}

export type CustomerEvent = { date: string; icon: string; color: string; title: string; sub?: string };

/** Weave real quotes/invoices/subscriptions into one reverse-chronological feed. */
export function buildCustomerActivity(subs: Subscription[], invoices: Invoice[], quotes: Quote[]): CustomerEvent[] {
  const events: CustomerEvent[] = [];
  for (const s of subs) {
    if (s.start_date) events.push({ date: s.start_date, icon: "refresh", color: "text-emerald", title: "Subscription started", sub: `${s.plan} · ${s.seats} seats` });
  }
  for (const q of quotes) {
    if (q.created_date) events.push({ date: q.created_date, icon: "file", color: "text-indigo", title: `Quote ${q.id} ${q.status}`, sub: q.plan ?? undefined });
  }
  for (const i of invoices) {
    if (i.paid_date) events.push({ date: i.paid_date, icon: "check_circle", color: "text-emerald", title: `Invoice ${i.id} paid`, sub: rupee(i.amount) });
    else if (i.invoice_date) events.push({ date: i.invoice_date, icon: "receipt", color: i.status === "overdue" ? "text-rose" : "text-ink-3", title: `Invoice ${i.id} ${i.status}`, sub: rupee(i.amount) });
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

// ════════════════════════════════════════════════════════════════════════
// Presentational components — identical across panel + 360 page
// ════════════════════════════════════════════════════════════════════════

/** 4-KPI answer-bar — health / owed / value in one glance (real numbers). */
export function CustomerMetricBar({ insights }: { insights: CustomerInsights }) {
  const { outstanding, overdueCount, lifetimePaid, totalMRR, activeSubs, seatsUsed, seatsTotal, nearestRenewal, renewalDays } = insights;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard
        label="Outstanding"
        value={outstanding > 0 ? rupee(outstanding) : "All clear"}
        tone={outstanding > 0 ? "danger" : "success"}
        hint={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
      />
      <MetricCard label="Lifetime paid" value={lifetimePaid > 0 ? rupee(lifetimePaid, { compact: lifetimePaid >= 100000 }) : "—"} />
      <MetricCard
        label="MRR"
        value={totalMRR > 0 ? rupee(totalMRR) : "—"}
        hint={activeSubs.length > 0 ? `${activeSubs.length} sub${activeSubs.length > 1 ? "s" : ""} · ${seatsUsed}/${seatsTotal} seats` : undefined}
      />
      <MetricCard
        label="Next renewal"
        value={nearestRenewal ? formatDate(nearestRenewal) : "—"}
        tone={renewalDays != null && renewalDays <= 30 ? "warning" : "default"}
        hint={renewalDays != null ? (renewalDays < 0 ? `${-renewalDays}d overdue` : `in ${renewalDays}d`) : undefined}
      />
    </div>
  );
}

const NBA_TONE: Record<Nba["tone"], { wrap: string; icon: string }> = {
  danger:  { wrap: "border-rose/30 bg-rose/5",         icon: "text-rose" },
  warning: { wrap: "border-amber/30 bg-amber-soft/40", icon: "text-amber" },
  info:    { wrap: "border-indigo/30 bg-indigo/5",     icon: "text-indigo" },
  success: { wrap: "border-emerald/30 bg-emerald/5",   icon: "text-emerald" },
};

/** Next-best-action card — kills decision fatigue. Money/contact actions draft
 *  a real, editable AI message (the genuine AI-native edge vs pre-AI tools). */
export function NextBestActionCard({ nba, customer }: { nba: Nba; customer: Customer }) {
  const router = useRouter();
  const tone = NBA_TONE[nba.tone];
  const cta = nba.cta;

  const phone = customer.contact_phone?.replace(/\s+/g, "");
  const channel = cta?.channel ?? "whatsapp";

  const [draft, setDraft] = React.useState<{ subject: string; message: string; mode: string } | null>(null);
  const [drafting, setDrafting] = React.useState(false);

  // Reset the draft when the selected customer changes (panel reuses this instance).
  React.useEffect(() => { setDraft(null); setDrafting(false); }, [customer.id]);

  async function generate() {
    if (!cta) return;
    setDrafting(true);
    setDraft(null);
    try {
      const res = await fetch("/api/ai/draft-followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, channel: cta.channel ?? "whatsapp", purpose: cta.purpose ?? "followup" }),
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
      : customer.contact_email
        ? `mailto:${customer.contact_email}?subject=${encodeURIComponent(draft.subject || `Regarding ${customer.name}`)}&body=${encodeURIComponent(draft.message)}`
        : null
    : null;

  return (
    <div className={cn("rounded-lg border p-3.5 flex items-start gap-3", tone.wrap)}>
      <div className={cn("mt-0.5", tone.icon)}><Icon name={nba.icon} size={18} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-0.5 inline-flex items-center gap-1">
          <Icon name="sparkles" size={11} className="text-amber" /> Next best action
        </div>
        <div className="text-sm font-medium text-ink leading-snug">{nba.title}</div>
        <p className="text-xs text-ink-2 mt-0.5 leading-relaxed">{nba.body}</p>

        {cta && (cta.kind === "profile" || cta.kind === "quote") && (
          <div className="mt-2.5">
            <Button size="sm" variant="primary" onClick={() => router.push((cta.kind === "quote" ? "/quotes/new" : `/customers/${customer.id}`) as never)}>
              {cta.label}
            </Button>
          </div>
        )}

        {cta && cta.kind === "draft" && (
          <div className="mt-2.5">
            {!draft && (
              <Button size="sm" variant="primary" onClick={generate} disabled={drafting}>
                <Icon name="sparkles" size={13} className="mr-1.5" />
                {drafting ? "Drafting…" : cta.label}
              </Button>
            )}
            {draft && (
              <div className="rounded-md border border-hairline bg-paper p-2.5">
                <Textarea
                  rows={channel === "email" ? 6 : 4}
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                />
                <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] text-ink-3">
                    {draft.mode === "gemini" ? "AI draft · verify the amount, then send" : "Template · add a Gemini key in Settings → Integrations for real AI"}
                  </span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="default" onClick={generate} disabled={drafting}>{drafting ? "…" : "Redraft"}</Button>
                    <Button size="sm" variant="default" onClick={() => { navigator.clipboard?.writeText(draft.message); toast.success("Copied"); }}>Copy</Button>
                    {sendLink && (
                      <Button asChild size="sm" variant="primary">
                        <a href={sendLink} target={channel === "whatsapp" ? "_blank" : undefined} rel="noopener noreferrer">
                          <Icon name={channel === "whatsapp" ? "whatsapp" : "mail"} size={13} className="mr-1.5" />Send
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Quick contact action buttons (Call / WhatsApp / Email) — real deep-links. */
export function CustomerContactActions({ customer }: { customer: Customer }) {
  const phone = customer.contact_phone?.replace(/\s+/g, "");
  return (
    <div className="flex flex-wrap gap-2">
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
      {customer.contact_email && (
        <Button asChild size="sm" variant="default">
          <a href={`mailto:${customer.contact_email}`}><Icon name="mail" size={13} className="mr-1.5" />Email</a>
        </Button>
      )}
    </div>
  );
}

const VENDOR_COLOR: Record<string, "info" | "indigo" | "amber" | "slate"> = {
  google: "info", microsoft: "indigo", zoho: "amber", other: "slate",
};

/** Subscription cards — plan, seats(used/total), MRR, renewal + state, owed pill. */
export function SubscriptionList({ subs }: { subs: Subscription[] }) {
  if (subs.length === 0) {
    return <PanelEmpty icon="refresh" text="No subscriptions yet — send the first quote to get them started." />;
  }
  return (
    <div className="space-y-2">
      {subs.map((s) => {
        const active = s.status === "active";
        const owed = s.outstanding_amount ?? 0;
        const renewalDays = s.renewal_date ? daysBetween(new Date(), s.renewal_date) : null;
        return (
          <div key={s.id} className="border border-hairline rounded-md px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-paper-2/30">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink truncate">{s.plan}</span>
                <Badge kind={active ? "success" : "muted"} color={VENDOR_COLOR[s.vendor] ?? "slate"} size="sm" dot>{s.status}</Badge>
              </div>
              <div className="text-[11px] text-ink-3 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>{s.used ?? 0}/{s.seats} seats</span>
                {s.renewal_date && (
                  <span className={cn(renewalDays != null && renewalDays <= 30 && "text-amber-ink")}>
                    Renews {formatDate(s.renewal_date)}{renewalDays != null && renewalDays <= 30 ? ` · ${renewalDays}d` : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-medium text-ink tabular-nums">{rupee(s.mrr)}<span className="text-[10px] text-ink-3">/mo</span></div>
              {owed > 0 && <div className="text-[11px] text-rose mt-0.5">{rupee(owed)} due</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Woven real-data activity feed. */
export function CustomerActivity({ subs, invoices, quotes, limit = 12 }: {
  subs: Subscription[]; invoices: Invoice[]; quotes: Quote[]; limit?: number;
}) {
  const events = buildCustomerActivity(subs, invoices, quotes).slice(0, limit);
  if (events.length === 0) return <PanelEmpty icon="clock" text="No activity yet." />;
  return (
    <ul className="space-y-3">
      {events.map((e, idx) => (
        <li key={idx} className="flex items-start gap-2.5">
          <Icon name={e.icon} size={14} className={cn("mt-0.5 flex-shrink-0", e.color)} />
          <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <span className="text-sm text-ink-2">{e.title}</span>
              {e.sub && <span className="text-[11px] text-ink-3 ml-1.5">· {e.sub}</span>}
            </div>
            <span className="text-[11px] text-ink-3 flex-shrink-0">{formatDate(e.date)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** GST / contact / address — the rarely-needed stuff, progressive-disclosure. */
export function CustomerDetailsGrid({ c }: { c: Customer }) {
  const tds = c.tds_default_rate_pct != null ? `${c.tds_default_section ?? "TDS"} @ ${c.tds_default_rate_pct}%` : null;
  const address = [c.address, c.state, c.pin_code].filter(Boolean).join(", ") || null;
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Tax &amp; compliance</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
          <Field label="GSTIN" value={c.gstin} mono badge={c.gstin ? (c.gstin_verified_at ? { kind: "success", text: "verified" } : { kind: "muted", text: "unverified" }) : undefined} />
          <Field label="Place of supply" value={c.state} />
          <Field label="TAN" value={c.tan} mono />
          <Field label="TDS" value={tds} />
        </dl>
      </div>
      <div className="pt-4 border-t border-hairline">
        <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Contact</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
          <Field label="Primary contact" value={c.contact_name} />
          <Field label="Title" value={c.contact_title} />
          <Field label="Email" value={c.contact_email} mono />
          <Field label="Phone" value={c.contact_phone} mono />
          <Field label="Address" value={address} />
          <Field label="Customer since" value={formatDate(c.since)} />
        </dl>
      </div>
      {c.notes && (
        <div className="pt-4 border-t border-hairline">
          <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1.5">Notes</div>
          <p className="text-sm text-ink-2 whitespace-pre-wrap">{c.notes}</p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Small shared primitives
// ──────────────────────────────────────────────────────────────────────
export function MetricCard({ label, value, tone = "default", hint }: {
  label: string; value: string; tone?: "default" | "danger" | "warning" | "success"; hint?: string;
}) {
  const valueColor =
    tone === "danger" ? "text-rose" : tone === "warning" ? "text-amber-ink" : tone === "success" ? "text-emerald" : "text-ink";
  return (
    <div className="bg-paper-2/40 border border-hairline rounded-md px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums mt-1 truncate", valueColor)}>{value}</div>
      {hint && <div className="text-[10px] text-ink-3 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

export function Field({ label, value, mono, badge }: {
  label: string; value?: string | null; mono?: boolean; badge?: { kind: "success" | "muted"; text: string };
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-0.5">{label}</dt>
      <dd className={cn("text-sm text-ink flex items-center gap-1.5", mono && "font-mono", !value && "italic text-ink-3 font-sans")}>
        <span className="truncate">{value || "—"}</span>
        {value && badge && <Badge kind={badge.kind} size="sm">{badge.text}</Badge>}
      </dd>
    </div>
  );
}

export function PanelEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="py-8 text-center">
      <Icon name={icon} size={22} className="text-ink-3 mx-auto mb-2" />
      <p className="text-sm text-ink-3 max-w-xs mx-auto">{text}</p>
    </div>
  );
}
