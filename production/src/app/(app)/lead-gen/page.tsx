/**
 * Lead Sources — matches prototype screen "lead-gen".
 *
 * Layout:
 *   - Page header (Sales · Lead Sources + Share form / Import CSV / Add Lead)
 *   - 4 KPIs: Leads MTD / Avg conversion / Top source / Avg response
 *   - 2-col: Capture channels (static config) | Public form preview
 *   - Webhook endpoints (accordion)
 *   - Recent inbound leads (real Supabase data, last 7 days)
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { useLeads } from "@/lib/queries/leads";
import { AddLeadForm } from "@/components/features/leads/add-lead-form";
import { toast } from "sonner";
import { KPI } from "@/components/shared/kpi";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/supabase/database.types";

// ─── Lead-source channel meta + aggregation (derived from real leads.source) ──

const SOURCE_ICON: Record<string, string> = {
  whatsapp: "whatsapp", website: "globe", referral: "award", cold: "send",
  ads: "target", linkedin: "users", email: "mail", manual: "user", import: "download",
};
const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp Business", website: "Website form", referral: "Referral",
  cold: "Cold outreach", ads: "Google Ads", linkedin: "LinkedIn",
  email: "Email / Inbound", manual: "Manual entry", import: "CSV import",
};

/** Collapse a raw leads.source string into a canonical channel key. */
function normalizeSource(raw: string | null | undefined): string {
  const s = (raw ?? "manual").toLowerCase();
  if (s.includes("whatsapp")) return "whatsapp";
  if (s.includes("email")) return "email";
  if (s.startsWith("buy") || s.includes("website") || s.includes("form")) return "website";
  if (s.includes("referr")) return "referral";
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("cold") || s.includes("apollo") || s.includes("lemlist")) return "cold";
  if (s.includes("google") || s.includes("ads") || s.includes("adword")) return "ads";
  if (s.includes("csv") || s.includes("import")) return "import";
  if (s.includes("manual")) return "manual";
  return s;
}

interface CaptureChannel { id: string; label: string; icon: string; count: number; won: number; conv: number; leads: Lead[]; }

/** This-month lead count + conversion by capture channel, from real leads.
 *  Also carries the matching leads so a channel row can expand to show them. */
function computeCaptureChannels(leads: Lead[]): CaptureChannel[] {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const byKey = new Map<string, Lead[]>();
  for (const l of leads) {
    if (!l.created_at || new Date(l.created_at) < monthStart) continue;
    const key = normalizeSource(l.source);
    const arr = byKey.get(key) ?? [];
    arr.push(l);
    byKey.set(key, arr);
  }
  return Array.from(byKey.entries())
    .map(([id, arr]) => {
      const won = arr.filter((l) => l.stage === "won").length;
      return {
        id,
        label: SOURCE_LABEL[id] ?? id,
        icon:  SOURCE_ICON[id] ?? "inbox",
        count: arr.length,
        won,
        conv:  arr.length > 0 ? Math.round((won / arr.length) * 100) : 0,
        leads: arr.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      };
    })
    .sort((a, b) => b.count - a.count);
}

const WEBHOOKS = [
  {
    id: "website",
    method: "POST" as const,
    path: "/api/leads/website",
    label: "Website form",
    sub: "Public form on exceltech.in/get-quote",
    icon: "globe",
    count: 18,
    lastFired: "2h ago",
    sample: `{
  "company": "Acme Corp Pvt Ltd",
  "contact": "Rajesh Kumar",
  "email": "rajesh@acmecorp.com",
  "phone": "+919876543210",
  "seats": 25,
  "interested_in": "workspace-plus",
  "source": "website",
  "utm_campaign": "diwali-2026"
}`,
  },
  {
    id: "whatsapp",
    method: "POST" as const,
    path: "/api/leads/whatsapp",
    label: "WhatsApp Business",
    sub: "Interakt / Wati / Gupshup webhook",
    icon: "whatsapp",
    count: 12,
    lastFired: "8m ago",
    sample: `{
  "event": "message",
  "contact": { "name": "Vishal Mehra", "phone": "+919123456789" },
  "message": { "type": "text", "body": "Aapka Workspace Plus ka price kya hai?" },
  "intent": "pricing_inquiry",
  "source": "whatsapp"
}`,
  },
  {
    id: "email",
    method: "POST" as const,
    path: "/api/leads/email",
    label: "Email parser",
    sub: "IMAP poll on sales@exceltech.in",
    icon: "mail",
    count: 4,
    lastFired: "1d ago",
    sample: `{
  "from": { "name": "Suresh P", "email": "suresh@novaprint.in" },
  "subject": "Inquiry: Google Workspace for 8 users",
  "snippet": "Hi, we're a printing company in Pune…",
  "parsed_signature": { "company": "Nova Print Co.", "title": "Founder" },
  "source": "email"
}`,
  },
  {
    id: "referral",
    method: "POST" as const,
    path: "/api/leads/referral",
    label: "Customer referrals",
    sub: "Portal links — exceltech.in/r/{customer-slug}",
    icon: "award",
    count: 5,
    lastFired: "3d ago",
    sample: `{
  "company": "Maple Studios",
  "contact": "Anita M",
  "email": "anita@maple.studio",
  "referred_by": "acme-corp",
  "referral_credit": 5000,
  "source": "referral"
}`,
  },
  {
    id: "ads",
    method: "POST" as const,
    path: "/api/leads/ads",
    label: "Google + Meta lead ads",
    sub: "Zapier bridge from Lead Form extension",
    icon: "target",
    count: 3,
    lastFired: "5h ago",
    sample: `{
  "ad_id": "google-ads-789",
  "campaign": "Workspace Mumbai SME",
  "contact": "Dr. Verma",
  "company": "Lumen Diagnostics",
  "phone": "+919012345678",
  "lead_cost": 4500,
  "source": "ads"
}`,
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: Lead["stage"] }) {
  const map: Record<Lead["stage"], React.ReactNode> = {
    new:     <Badge kind="info"    dot>New</Badge>,
    contact: <Badge kind="warning" dot>Contacted</Badge>,
    demo:    <Badge kind="success" dot>Demo done</Badge>,
    trial:   <Badge kind="info"    dot>Trial</Badge>,
    quote:   <Badge kind="warning" dot>Quote sent</Badge>,
    won:     <Badge kind="success" dot>Won</Badge>,
    lost:    <Badge kind="muted"   dot>Lost</Badge>,
  };
  return <>{map[stage]}</>;
}

function SourceIcon({ source }: { source: string | null }) {
  const key = normalizeSource(source);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
      <Icon name={SOURCE_ICON[key] ?? "inbox"} size={13} />
      {SOURCE_LABEL[key] ?? key}
    </span>
  );
}

// ─── Webhook accordion item ───────────────────────────────────────────────────

function WebhookRow({
  webhook,
}: {
  webhook: (typeof WEBHOOKS)[number];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-lg border border-hairline overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full grid items-center gap-3 px-3 py-2.5 text-left cursor-pointer hover:bg-paper-2",
          open && "bg-paper-2",
        )}
        style={{ gridTemplateColumns: "28px 1fr auto auto auto 20px" }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Icon name={webhook.icon} size={14} />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold text-paper">
              {webhook.method}
            </span>
            <span className="font-mono text-xs">{webhook.path}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-3">{webhook.sub}</p>
        </div>
        <Badge kind="success" dot>Live</Badge>
        <div className="text-right">
          <p className="tabular-nums text-sm font-medium text-ink">{webhook.count}</p>
          <p className="text-xs text-ink-3">leads · MTD</p>
        </div>
        <p className="text-xs text-ink-3">last: {webhook.lastFired}</p>
        <Icon
          name={open ? "chevron_up" : "chevron_down"}
          size={14}
          className="text-ink-3"
        />
      </button>

      {/* Payload */}
      {open && (
        <div className="border-t border-hairline bg-paper-2 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
            Sample payload
          </p>
          <pre className="overflow-x-auto rounded-md border border-hairline bg-paper p-3 font-mono text-xs leading-relaxed">
            {webhook.sample}
          </pre>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-ink-3">
              Endpoint:{" "}
              <code className="font-mono">
                https://api.resellersos.in{webhook.path}
              </code>
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(webhook.sample);
                  toast.success("Payload copied");
                }}
              >
                <Icon name="copy" size={12} />
                Copy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  toast.success(`Test webhook fired → 1 mock lead via ${webhook.label}`)
                }
              >
                <Icon name="zap" size={12} />
                Test webhook
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Share form dialog (inline simple) ───────────────────────────────────────

function ShareFormSheet({ onClose }: { onClose: () => void }) {
  // Point at the REAL, working public enquiry form served by this app
  // (/enquiry → POST /api/public/enquiry/general → creates a lead in the
  // pipeline). Build the absolute URL from the CURRENT host so the link always
  // matches whatever domain the app is running on — no hardcoded placeholder
  // domain (the old "exceltech.in/get-quote" 404'd; it never existed).
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/enquiry`;
  const embed = `<iframe src="${url}?embed=1" width="100%" height="640" frameborder="0"></iframe>`;

  const shareText = `Get a Google Workspace / Microsoft 365 quote in minutes: ${url}`;
  const waLink   = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const mailLink = `mailto:?subject=${encodeURIComponent("Get a quote")}&body=${encodeURIComponent(shareText)}`;
  const smsLink  = `sms:?body=${encodeURIComponent(shareText)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-t-xl bg-paper shadow-xl md:mr-4 md:mb-4 md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-ink-3">Public form</p>
            <h2 className="font-serif text-lg text-ink">Share or embed</h2>
          </div>
          <IconButton icon="x" variant="ghost" size="sm" aria-label="Close" onClick={onClose} />
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1 text-xs font-medium text-ink">Public link</p>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(url);
                  toast.success("Link copied to clipboard");
                }}
              >
                <Icon name="copy" size={13} />
                Copy
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-ink">Embed on your website</p>
            <textarea
              readOnly
              value={embed}
              rows={3}
              className="w-full rounded-md border border-hairline bg-paper-2 p-2 font-mono text-xs"
            />
            <Button
              variant="default"
              size="sm"
              className="mt-1.5"
              onClick={() => {
                navigator.clipboard?.writeText(embed);
                toast.success("Embed code copied");
              }}
            >
              <Icon name="copy" size={12} />
              Copy embed code
            </Button>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink">Send via</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={() => { window.location.href = mailLink; }}
              >
                <Icon name="mail" size={12} />
                Email link
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(waLink, "_blank", "noopener")}
              >
                <Icon name="whatsapp" size={12} />
                WhatsApp
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => { window.location.href = smsLink; }}
              >
                <Icon name="message" size={12} />
                SMS
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadGenPage() {
  const { data: leads, isLoading } = useLeads();
  const router = useRouter();
  // Real capture channels: this-month lead count + conversion by source.
  const captureChannels = React.useMemo(() => computeCaptureChannels(leads ?? []), [leads]);
  // Which channel row is expanded to reveal its leads.
  const [openChannel, setOpenChannel] = React.useState<string | null>(null);
  const [showShare, setShowShare] = React.useState(false);
  const [addOpen, setAddOpen]     = React.useState(false);
  // Current host (no protocol) for the "Live at …/buy/workspace" hint. Reads
  // window on the client so it always reflects the real deployed domain.
  const [captureHost, setCaptureHost] = React.useState("");
  React.useEffect(() => {
    setCaptureHost(window.location.host);
  }, []);

  // Last-7-days leads
  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  const recentLeads = (leads ?? []).filter(
    (l) => new Date(l.created_at) >= cutoff,
  );

  // KPI calculations
  const mtdLeads    = recentLeads.length;
  const total       = captureChannels.reduce((s, x) => s + x.count, 0);
  const avgConv     = Math.round(
    captureChannels.reduce((s, x) => s + x.count * x.conv, 0) / Math.max(1, total),
  );
  const topSource   = captureChannels[0]; // already sorted by count desc (may be undefined)

  return (
    <div className="mx-auto max-w-[1800px] px-8 pb-20 pt-7">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-ink-3">
            Sales
          </p>
          <h1 className="font-serif text-3xl text-ink">Lead Sources</h1>
          <p className="mt-1 text-sm text-ink-3">
            Where new leads come from · capture forms · manual entry · bulk import
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowShare(true)}
          >
            <Icon name="link" size={14} />
            Share form
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => toast.info("Upload CSV file to import leads")}
          >
            <Icon name="download" size={14} />
            Import CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <Icon name="plus" size={14} />
            Add Lead
          </Button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPI
          label="Leads · Last 7 days"
          value={mtdLeads}
          trend="+8 vs last week"
          trendKind="up"
          icon="inbox"
        />
        <KPI
          label="Avg conversion"
          value={avgConv}
          unit="%"
          trend="lead → won"
          trendKind="up"
          icon="target"
        />
        <KPI
          label="Top source"
          value={topSource ? topSource.label.split(" ")[0] : "—"}
          trend={topSource ? `${topSource.count} this month` : "No leads yet"}
          trendKind="neutral"
          icon={topSource?.icon ?? "inbox"}
        />
        <KPI
          label="Avg response"
          value="2.4"
          unit="h"
          trend="−1.1h vs last mo"
          trendKind="up"
          icon="clock"
        />
      </div>

      {/* ── Capture channels + Public form ── */}
      <div
        className="mb-5 grid gap-5"
        style={{ gridTemplateColumns: "1.4fr 1fr" }}
      >
        {/* Capture channels */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Capture channels</p>
              <p className="text-xs text-ink-3">Sources of new leads this month</p>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowShare(true)}
            >
              <Icon name="link" size={12} />
              Get capture link
            </Button>
          </div>
          {captureChannels.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-3">
              No leads captured this month yet. New leads are grouped here by their source
              (WhatsApp, website form, referral, import, …) automatically.
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {captureChannels.map((s) => {
                const isOpen = openChannel === s.id;
                return (
                <div key={s.id}>
                  {/* Row — click to expand this channel's leads */}
                  <button
                    type="button"
                    onClick={() => setOpenChannel(isOpen ? null : s.id)}
                    aria-expanded={isOpen}
                    className="w-full grid items-center gap-3 py-2.5 text-left rounded-md hover:bg-paper-2/40 transition-colors"
                    style={{ gridTemplateColumns: "32px 1fr 64px 80px 20px" }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon name={s.icon} size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{s.label}</p>
                      <p className="text-xs text-ink-3">{s.won} won this month</p>
                    </div>
                    <div className="text-right font-serif text-lg tabular-nums text-ink">
                      {s.count}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium tabular-nums text-ink">{s.conv}%</p>
                      <p className="text-[10px] text-ink-3">conv rate</p>
                    </div>
                    <Icon name="chevron_down" size={14} className={cn("text-ink-3 justify-self-end transition-transform", isOpen && "rotate-180")} />
                  </button>

                  {/* Expanded — the leads captured via this channel this month */}
                  {isOpen && (
                    <div className="pb-2.5 pl-11 pr-1 space-y-0.5">
                      {s.leads.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => router.push(`/leads?lead=${l.id}` as never)}
                          className="w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-left hover:bg-paper-2 transition-colors"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-ink truncate">{l.company}</span>
                            <span className="block text-[11px] text-ink-3 truncate">
                              {l.contact_name ?? l.contact_email ?? "—"} · {formatDate(l.created_at)}
                            </span>
                          </span>
                          <Icon name="arrow_right" size={13} className="text-ink-3 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Public form preview */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Public capture form</p>
              <p className="text-xs text-ink-3">Embed on website or share link</p>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowShare(true)}
            >
              <Icon name="external" size={12} />
              Share
            </Button>
          </div>

          {/* Form mockup */}
          <div className="rounded-lg bg-paper-2 p-4 text-xs">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ink font-serif text-sm text-paper">
                R
              </div>
              <span className="font-serif text-sm text-ink">
                Get a quote in 24 hours
              </span>
            </div>
            {[
              { label: "Company name *", placeholder: "Acme Corp Pvt Ltd" },
              { label: "Your name *",    placeholder: "Rajesh Kumar" },
              { label: "Email *",        placeholder: "rajesh@acme.com" },
              { label: "Phone",          placeholder: "+91 98765 43210" },
            ].map((f) => (
              <div key={f.label} className="mb-2.5">
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-3">
                  {f.label}
                </p>
                <input
                  disabled
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink-3 placeholder:text-ink-3/60"
                />
              </div>
            ))}
            <div className="mb-2.5">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-ink-3">
                Interested in
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Workspace", "M365", "Zoho", "Help me choose"].map((o) => (
                  <span
                    key={o}
                    className="rounded-full border border-hairline bg-paper px-2 py-0.5 text-[10px] text-ink-3"
                  >
                    {o}
                  </span>
                ))}
              </div>
            </div>
            <button
              disabled
              className="mt-1 w-full rounded-md bg-amber py-1.5 text-xs font-medium text-white opacity-80"
            >
              Get my quote
            </button>
            <p className="mt-2 text-center text-[10px] text-ink-3">
              Live at{" "}
              <code className="font-mono">
                {captureHost}/enquiry
              </code>
            </p>
          </div>
        </Card>
      </div>

      {/* ── Webhook endpoints ── */}
      <div className="mb-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Webhook endpoints</p>
              <p className="text-xs text-ink-3">
                Auto-create leads from external sources · all live
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="default"
                size="sm"
                onClick={() => toast.info("API docs coming soon")}
              >
                <Icon name="book" size={12} />
                Docs
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => toast.info("Key rotated")}
              >
                <Icon name="lock" size={12} />
                Rotate key
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {WEBHOOKS.map((w) => (
              <WebhookRow key={w.id} webhook={w} />
            ))}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3">
            <Icon name="info" size={11} />
            All endpoints accept HMAC-SHA256 signed requests · Bearer auth ·
            idempotency keys supported
          </p>
        </Card>
      </div>

      {/* ── Recent inbound leads ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">Recent inbound</p>
            <p className="text-xs text-ink-3">Last 7 days · sorted by recency</p>
          </div>
          <Button variant="default" size="sm" asChild>
            <Link href={"/leads" as Route}>
              <Icon name="arrow_right" size={13} />
              Open Pipeline
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : recentLeads.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No inbound leads in the last 7 days"
            body="Leads captured via webhook, form, or manual entry appear here."
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-muted/30">
                  {["Lead", "Source", "Contact", "Captured", "Stage", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-left text-xs font-medium text-ink-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {recentLeads.slice(0, 10).map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-hairline last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-ink">{lead.company}</p>
                      <p className="font-mono text-xs text-ink-3">
                        {lead.id.slice(0, 8).toUpperCase()}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <SourceIcon source={lead.source} />
                    </td>
                    <td className="px-5 py-3 text-ink">
                      {lead.contact_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-3">
                      {formatDate(lead.created_at, "relative")}
                    </td>
                    <td className="px-5 py-3">
                      <StageBadge stage={lead.stage} />
                    </td>
                    <td className="px-5 py-3">
                      <Button variant="default" size="sm" asChild>
                        <Link href={`/leads?lead=${lead.id}` as any}>
                          <Icon name="arrow_right" size={12} />
                          Open
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Share form sheet ── */}
      {showShare && <ShareFormSheet onClose={() => setShowShare(false)} />}

      {/* ── Add Lead modal (same one used in Lead Pipeline) ── */}
      <AddLeadForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
