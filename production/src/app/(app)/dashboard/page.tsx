/**
 * Dashboard — matches prototype layout.
 *
 * Layout:
 *   - Header (date eyebrow, "Good morning, Name", subtitle, Quick-add)
 *   - 6 KPI grid (MRR / Pipeline / Renewals Due / Overdue / CSAT / Churn)
 *   - Main 1.55fr 1fr grid:
 *     LEFT  → Today's Focus + Recent Activity + Pipeline by Stage
 *     RIGHT → Sales Leaderboard + Coming Up + Health
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLeads } from "@/lib/queries/leads";
import { useCustomers } from "@/lib/queries/customers";
import { useQuotes } from "@/lib/queries/quotes";
import { useSubscriptions } from "@/lib/queries/subscriptions";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { KPI } from "@/components/shared/kpi";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { rupee } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ============================================================
// Lead stage config (matches prototype LEAD_STAGES)
// ============================================================
const LEAD_STAGES = [
  { id: "new",     label: "New",          dot: "bg-slate",   color: "bg-slate" },
  { id: "contact", label: "Contacted",    dot: "bg-amber",   color: "bg-amber" },
  { id: "demo",    label: "Demo Done",    dot: "bg-indigo",  color: "bg-indigo" },
  { id: "trial",   label: "Trial Active", dot: "bg-rose",    color: "bg-rose" },
  { id: "quote",   label: "Quote Sent",   dot: "bg-indigo",  color: "bg-indigo" },
  { id: "won",     label: "Won",          dot: "bg-emerald", color: "bg-emerald" },
] as const;

export default function DashboardPage() {
  const router = useRouter();

  // Real data
  const { data: leads }         = useLeads();
  const { data: customers }     = useCustomers();
  const { data: quotes }        = useQuotes();
  const { data: subscriptions } = useSubscriptions();
  const { data: currentUser }   = useCurrentUser();

  // Time-aware greeting + date
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
  const firstName = currentUser?.fullName?.split(/\s+/)[0] ?? "there";
  const workspaceName = currentUser?.tenantName ?? "your workspace";

  // Aggregates from real data
  const activeLeads     = (leads ?? []).filter((l) => l.stage !== "won" && l.stage !== "lost");
  const totalPipeline   = activeLeads.reduce((s, l) => s + (l.value ?? 0), 0);
  const newToday        = (leads ?? []).filter((l) => {
    const d = new Date(l.created_at);
    return d.toDateString() === new Date().toDateString();
  }).length;
  const totalCustomers  = customers?.length ?? 0;
  const acceptedQuotes  = (quotes ?? []).filter((q) => q.status === "accepted");
  const acceptedValue   = acceptedQuotes.reduce((s, q) => s + (q.amount ?? 0), 0);
  const draftQuotes     = (quotes ?? []).filter((q) => q.status === "draft").length;

  // Subscription aggregates — sum MRR across active subs only
  const activeSubs    = (subscriptions ?? []).filter((s) => s.status === "active");
  const activeMRR     = activeSubs.reduce((s, x) => s + (x.mrr ?? 0), 0);

  // Today's focus — built from real data
  const focus = [
    activeLeads.length > 0 && {
      icon: "target", tone: "indigo",
      title: `${activeLeads.length} active leads in pipeline`,
      note: `${rupee(totalPipeline, { compact: true })} pipeline value`,
      action: "View", cta: "/leads",
    },
    draftQuotes > 0 && {
      icon: "file", tone: "amber",
      title: `${draftQuotes} draft quote${draftQuotes === 1 ? "" : "s"} to finalize`,
      note: "Not yet sent to customers",
      action: "Open", cta: "/quotes",
    },
    acceptedQuotes.length > 0 && {
      icon: "check_circle", tone: "emerald",
      title: `${acceptedQuotes.length} accepted quote${acceptedQuotes.length === 1 ? "" : "s"}`,
      note: `${rupee(acceptedValue, { compact: true })} ready to invoice`,
      action: "Process", cta: "/quotes",
    },
    totalCustomers === 0 && {
      icon: "users", tone: "amber",
      title: "Add your first customer",
      note: "Start tracking customer health + renewals",
      action: "Add", cta: "/customers",
    },
    {
      icon: "flame", tone: "rose",
      title: `${newToday} new lead${newToday === 1 ? "" : "s"} today`,
      note: newToday > 0 ? "Worth focusing on early" : "Quiet day",
      action: "View",
      cta: "/leads",
    },
  ].filter(Boolean) as Array<{ icon: string; tone: string; title: string; note: string; action: string; cta: string }>;

  // Stubbed sections (not in DB yet)
  const activity = [
    { icon: "rupee",  tone: "emerald", title: `Welcome to your workspace, ${customers ? "Pardeep" : "Pardeep"}`,                 time: "Just now" },
    { icon: "users",  tone: "indigo",  title: `${totalCustomers} customer${totalCustomers === 1 ? "" : "s"} in your workspace`, time: "Today" },
    { icon: "target", tone: "amber",   title: `${activeLeads.length} active lead${activeLeads.length === 1 ? "" : "s"}`,        time: "Today" },
    { icon: "file",   tone: "slate",   title: `${quotes?.length ?? 0} quote${quotes?.length === 1 ? "" : "s"} created`,         time: "Today" },
  ];

  const leaderboard = [
    { rank: 1, name: "Pardeep Sharma (you)", amount: acceptedValue, deals: acceptedQuotes.length, color: "amber" },
  ];

  const upcoming = [
    { type: "Demo", who: "TechBrand Pvt Ltd",       time: "Today 2:30 PM",     icon: "users",     tone: "indigo" },
    { type: "Call", who: "Cosmo Tech (renewal)",    time: "Today 4:00 PM",     icon: "phone",     tone: "amber" },
    { type: "Demo", who: "Beta Industries",         time: "Tomorrow 11 AM",    icon: "users",     tone: "indigo" },
  ];

  const integrations = [
    { name: "Supabase Auth + DB",         status: "Live",       tone: "ok" as const },
    { name: "Razorpay",                   status: "Not setup",  tone: "warn" as const },
    { name: "GST e-Invoice (NIC/IRP)",    status: "Not setup",  tone: "warn" as const },
    { name: "Google CSP Reseller API",    status: "Not setup",  tone: "warn" as const },
    { name: "WhatsApp Business (Gupshup)", status: "Not setup", tone: "warn" as const },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">
            {dateLabel}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">
            {greeting}, {firstName}.
          </h1>
          <p className="text-sm text-ink-3 mt-1">
            Here's what's happening at <b className="text-ink">{workspaceName}</b> today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="primary" icon="plus">
            <Link href={"/quotes/new" as any}>Quick add quote</Link>
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KPI
          label="MRR"
          value={subscriptions ? rupee(activeMRR, { compact: true }) : "—"}
          trend={
            activeSubs.length === 0
              ? "No subs yet"
              : `${activeSubs.length} active sub${activeSubs.length === 1 ? "" : "s"}`
          }
          trendKind={activeMRR > 0 ? "up" : "neutral"}
          trendIcon={activeMRR > 0 ? "trending_up" : undefined}
          icon="rupee"
        />
        <KPI
          label="Pipeline"
          value={rupee(totalPipeline, { compact: true })}
          trend={`${activeLeads.length} active deals`}
          trendKind="up"
          trendIcon="trending_up"
          icon="target"
        />
        <KPI
          label="Accepted (MTD)"
          value={rupee(acceptedValue, { compact: true })}
          trend={`${acceptedQuotes.length} quote${acceptedQuotes.length === 1 ? "" : "s"}`}
          trendKind="up"
          trendIcon="check"
        />
        <KPI
          label="Customers"
          value={totalCustomers}
          trend="In your tenant"
          icon="users"
        />
        <KPI
          label="Drafts"
          value={draftQuotes}
          trend="Pending send"
          trendKind="neutral"
          icon="file"
        />
        <KPI
          label="Health"
          value="100"
          unit="%"
          trend="Setup complete"
          trendKind="up"
          trendIcon="check_circle"
        />
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 items-start">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Today's Focus */}
          <Card
            title="Today's Focus"
            sub="What needs your attention now"
            actions={<Button size="sm" variant="ghost" icon="filter">All</Button>}
            flush
          >
            <div className="px-4 pb-3">
              {focus.map((f, i) => (
                <FocusRow
                  key={i}
                  icon={f.icon}
                  tone={f.tone}
                  title={f.title}
                  note={f.note}
                  action={f.action}
                  onClick={() => router.push(f.cta as any)}
                  isLast={i === focus.length - 1}
                />
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card
            title="Recent Activity"
            sub="Last 24 hours"
            actions={<Button size="sm" variant="ghost" iconRight="external">Full feed</Button>}
          >
            <div className="space-y-3">
              {activity.map((a, i) => (
                <ActivityRow key={i} icon={a.icon} tone={a.tone} title={a.title} time={a.time} />
              ))}
            </div>
          </Card>

          {/* Pipeline by Stage */}
          <Card
            title="Pipeline by Stage"
            sub={
              activeLeads.length > 0
                ? `${rupee(totalPipeline, { compact: true })} across ${activeLeads.length} deal${activeLeads.length === 1 ? "" : "s"}`
                : "No active deals yet"
            }
          >
            {!leads ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6" />)}
              </div>
            ) : activeLeads.length === 0 ? (
              <div className="py-6 text-center text-sm text-ink-3">
                Add your first lead at{" "}
                <Link href={"/leads" as any} className="text-amber-ink underline">/leads</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {LEAD_STAGES.map((s) => {
                  const stageLeads = (leads ?? []).filter((l) => l.stage === s.id);
                  const value = stageLeads.reduce((sum, l) => sum + (l.value ?? 0), 0);
                  const maxValue = Math.max(1, ...LEAD_STAGES.map((stg) =>
                    (leads ?? []).filter((l) => l.stage === stg.id).reduce((s, l) => s + (l.value ?? 0), 0)
                  ));
                  const pct = (value / maxValue) * 100;
                  return (
                    <div key={s.id} className="grid grid-cols-[120px_1fr_90px_36px] items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
                        {s.label}
                      </div>
                      <div className="h-2 rounded-full bg-paper-2 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", s.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-right tabular-nums text-sm text-ink-2">
                        {value > 0 ? rupee(value, { compact: true }) : "—"}
                      </div>
                      <div className="text-right tabular-nums text-xs text-ink-3">
                        {stageLeads.length}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* Sales Leaderboard */}
          <Card title="Sales Leaderboard" sub="This month">
            <div className="space-y-3">
              {leaderboard.map((p) => (
                <div key={p.rank} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div className={cn(
                    "w-7 h-7 rounded-full grid place-items-center font-serif text-sm",
                    p.rank === 1 ? "bg-amber text-white" : "bg-paper-2 text-ink-2"
                  )}>
                    {p.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-ink-3">{p.deals} deal{p.deals === 1 ? "" : "s"} closed</div>
                  </div>
                  <div className="font-serif tabular-nums text-lg">{rupee(p.amount, { compact: true })}</div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <div className="text-center text-sm text-ink-3 py-2">No closed deals yet</div>
              )}
            </div>
          </Card>

          {/* Coming Up */}
          <Card title="Coming Up" sub="Next 24 hours">
            <div className="space-y-3">
              {upcoming.map((u, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-md border border-hairline grid place-items-center",
                    u.tone === "indigo" && "text-indigo",
                    u.tone === "amber"  && "text-amber-ink",
                  )}>
                    <Icon name={u.icon} size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{u.type}: <span className="font-normal">{u.who}</span></div>
                    <div className="text-[11px] text-ink-3">{u.time}</div>
                  </div>
                  <IconButton icon="arrow_right" aria-label="Open" size="sm" />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-3 italic mt-3 pt-3 border-t border-hairline">
              Stub data · Calendar integration coming in Phase 2.
            </p>
          </Card>

          {/* Integration Health */}
          <Card title="Health" sub="System & integrations">
            <div className="space-y-2">
              {integrations.map((s) => (
                <div key={s.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      s.tone === "ok" ? "bg-emerald" : "bg-amber"
                    )} />
                    <span>{s.name}</span>
                  </div>
                  <span className={cn(
                    s.tone === "ok" ? "text-emerald" : "text-amber-ink"
                  )}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FocusRow — matches prototype's focus-row pattern
// ============================================================
function FocusRow({
  icon, tone, title, note, action, onClick, isLast,
}: {
  icon: string; tone: string; title: string; note: string; action: string; onClick: () => void; isLast: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[32px_1fr_auto] items-center gap-3 py-2.5",
        !isLast && "border-b border-hairline"
      )}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-md grid place-items-center",
          tone === "indigo"  && "bg-indigo-soft text-indigo",
          tone === "amber"   && "bg-amber-soft text-amber-ink",
          tone === "emerald" && "bg-emerald-soft text-emerald",
          tone === "rose"    && "bg-rose-soft text-rose",
        )}
      >
        <Icon name={icon} size={14} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight">{title}</div>
        <div className="text-[11px] text-ink-3 mt-0.5">{note}</div>
      </div>
      <Button size="sm" variant="ghost" iconRight="arrow_right" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

// ============================================================
// ActivityRow — matches prototype's activity pattern
// ============================================================
function ActivityRow({ icon, tone, title, time }: { icon: string; tone: string; title: string; time: string }) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
      <div className={cn(
        "w-6 h-6 rounded-full grid place-items-center",
        tone === "indigo"  && "bg-indigo-soft text-indigo",
        tone === "amber"   && "bg-amber-soft text-amber-ink",
        tone === "emerald" && "bg-emerald-soft text-emerald",
        tone === "rose"    && "bg-rose-soft text-rose",
        tone === "slate"   && "bg-slate-soft text-slate",
      )}>
        <Icon name={icon} size={12} />
      </div>
      <div className="text-sm">{title}</div>
      <div className="text-[11px] text-ink-3">{time}</div>
    </div>
  );
}
