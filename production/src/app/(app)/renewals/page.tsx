/**
 * Renewals Dashboard — matches prototype screen C8.
 *
 * Layout:
 *   - Page header (eyebrow/title/subtitle + Export / Bulk-reminder)
 *   - 5 KPIs: Urgent / Upcoming / Future / High-Risk / Renewal rate
 *   - GeminiCard: next-best-actions
 *   - RenewalBucket × 3 (Urgent rose / Upcoming amber / Future emerald)
 *
 * Risk model (same deterministic algorithm as prototype):
 *   - Seat utilisation (used/seats)
 *   - Plan tier (starter = +20)
 *   - Mock "last admin login" (derived from id hash)
 *   - Mock support tickets (derived from id hash)
 *   - Mock NPS (derived from id hash)
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubscriptions } from "@/lib/queries/subscriptions";
import { toast } from "sonner";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { KPI } from "@/components/shared/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate, daysBetween } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Subscription } from "@/lib/supabase/database.types";
import { renewalStateLabel, renewalStateTone } from "@/lib/renewals/cadence";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";

// ─── Risk model ──────────────────────────────────────────────────────────────

interface RiskResult {
  score: number;
  level: "high" | "medium" | "low";
  /** Badge `kind` prop value */
  badgeKind: "danger" | "warning" | "success";
  label: string;
  reasons: string[];
  lastLoginDays: number;
  tickets: number;
  nps: number;
}

/**
 * Deterministic churn-risk score (0–100) for a subscription.
 * Production would pull live signals (analytics, NPS, payment history).
 * For now: derive from subscription characteristics so the same record
 * always renders the same risk level.
 */
function renewalRisk(sub: Subscription): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  // Signal 1: Seat utilisation
  const utilisation = sub.used / Math.max(1, sub.seats);
  if (utilisation < 0.7) {
    score += 35;
    reasons.push(`Low seat usage (${Math.round(utilisation * 100)}%)`);
  } else if (utilisation < 0.85) {
    score += 15;
    reasons.push(`Moderate seat usage (${Math.round(utilisation * 100)}%)`);
  }

  // Signal 2: Plan tier
  const plan = sub.plan.toLowerCase();
  if (plan.includes("starter")) {
    score += 20;
    reasons.push("Lower-tier plan (Starter)");
  } else if (plan.includes("std") && !plan.includes("plus")) {
    score += 5;
  }

  // Signal 3: Mock last admin login (derived from id hash for determinism)
  const idHash = sub.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 100;
  const lastLoginDays = (idHash * 7) % 60; // 0–60 days
  if (lastLoginDays > 30) {
    score += 25;
    reasons.push(`No admin login for ${lastLoginDays} days`);
  } else if (lastLoginDays > 14) {
    score += 10;
    reasons.push(`Last admin login ${lastLoginDays}d ago`);
  }

  // Signal 4: Mock support tickets
  const tickets = (idHash * 3) % 8;
  if (tickets >= 5) {
    score += 20;
    reasons.push(`${tickets} support tickets in last 30 days`);
  } else if (tickets >= 3) {
    score += 8;
    reasons.push(`${tickets} support tickets recently`);
  }

  // Signal 5: Mock NPS (0–9)
  const nps = 9 - (idHash % 10);
  if (nps <= 4) {
    score += 25;
    reasons.push(`Low NPS score (${nps}/10)`);
  } else if (nps <= 6) {
    score += 10;
    reasons.push(`Neutral NPS (${nps}/10)`);
  }

  score = Math.min(100, score);

  const level: RiskResult["level"] =
    score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const badgeKind: RiskResult["badgeKind"] =
    level === "high" ? "danger" : level === "medium" ? "warning" : "success";
  const label =
    level === "high" ? "HIGH RISK" : level === "medium" ? "Medium" : "Healthy";

  return { score, level, badgeKind, label, reasons, lastLoginDays, tickets, nps };
}

// ─── Vendor logo pill ─────────────────────────────────────────────────────────

function VendorPill({ vendor }: { vendor: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    google:    { label: "Google",    cls: "bg-blue-50 text-blue-700" },
    microsoft: { label: "Microsoft", cls: "bg-indigo-50 text-indigo-700" },
    zoho:      { label: "Zoho",      cls: "bg-amber-50 text-amber-700" },
    other:     { label: "Other",     cls: "bg-muted text-muted-foreground" },
  };
  const v = map[vendor] ?? map.other;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        v.cls,
      )}
    >
      {v.label}
    </span>
  );
}

// ─── RenewalBucket ────────────────────────────────────────────────────────────

interface RenewalBucketProps {
  kind: "rose" | "amber" | "emerald";
  title: string;
  subtitle: string;
  rows: Array<{ sub: Subscription; daysUntil: number }>;
  graceDays: number;
  defaultOpen?: boolean;
}

function RenewalBucket({
  kind,
  title,
  subtitle,
  rows,
  graceDays,
  defaultOpen = true,
}: RenewalBucketProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [sending, setSending] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const router = useRouter();

  async function handleGenerateQuote(sub: Subscription) {
    setGenerating(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/generate-renewal-quote`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not generate renewal quote");
        return;
      }
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      const msg = json.alreadyExisted
        ? `Opening existing renewal quote for ${sub.customer_name}`
        : `Renewal quote ${json.quoteId} created for ${sub.customer_name}`;
      toast.success(msg, { duration: 3500 });
      // Navigate so the operator can edit before sending
      router.push(`/quotes/${json.quoteId}` as never);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setGenerating(null);
    }
  }

  async function handleSendNow(sub: Subscription) {
    setSending(sub.id);
    try {
      const res = await fetch("/api/renewals/send-now", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subscription_id: sub.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Send failed");
        return;
      }
      const mode = json.email_mode === "stub" ? " (stub mode — no real email)" : "";
      toast.success(`${json.status === "sent" ? "Sent" : "Logged"} ${json.step} to ${sub.customer_name}${mode}`);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (err) {
      toast.error(`Send failed: ${(err as Error).message}`);
    } finally {
      setSending(null);
    }
  }

  const dotCls =
    kind === "rose"
      ? "bg-rose-500"
      : kind === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <Card className="overflow-hidden">
      {/* Bucket header */}
      <div
        className={cn(
          "flex items-center justify-between px-5 py-4",
          open && "border-b border-hairline",
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotCls)} />
          <div>
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-xs text-ink-3">
              {subtitle} ·{" "}
              <span className="tabular-nums">{rows.length}</span>{" "}
              {rows.length === 1 ? "subscription" : "subscriptions"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(!open)}
          className="gap-1 text-xs"
        >
          {open ? "Hide" : "Show"}
          <Icon name={open ? "chevron_up" : "chevron_down"} size={14} />
        </Button>
      </div>

      {/* Table */}
      {open && (
        <>
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-3">
              No subscriptions in this window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-muted/30">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-ink-3">
                      Customer
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                      Plan
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                      Vendor
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-3">
                      Seats
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                      Renewal date
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-3">
                      MRR
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                      Cadence
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                      Churn risk
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ sub, daysUntil: days }) => {
                    const risk = renewalRisk(sub);
                    return (
                      <tr
                        key={sub.id}
                        className="border-b border-hairline last:border-0 hover:bg-muted/20"
                      >
                        {/* Customer + Domain */}
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink leading-tight">
                            {sub.customer_name}
                          </p>
                          {sub.domain && (
                            <p className="mt-0.5 font-mono text-xs text-ink-3">
                              {sub.domain}
                            </p>
                          )}
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3 text-ink">{sub.plan}</td>

                        {/* Vendor */}
                        <td className="px-4 py-3">
                          <VendorPill vendor={sub.vendor} />
                        </td>

                        {/* Seats */}
                        <td className="px-4 py-3 text-right tabular-nums text-ink">
                          {sub.seats}
                        </td>

                        {/* Renewal date + urgency badge + last reminder */}
                        <td className="px-4 py-3">
                          <p className="text-ink">
                            {sub.renewal_date ? formatDate(sub.renewal_date) : "—"}
                          </p>
                          <div className="mt-0.5">
                            {days < 0 ? (
                              <Badge kind="danger" dot>
                                Expired {Math.abs(days)}d ago
                              </Badge>
                            ) : days <= 7 ? (
                              <Badge kind="danger" dot>
                                {days}d
                              </Badge>
                            ) : days <= 30 ? (
                              <Badge kind="warning" dot>
                                {days}d
                              </Badge>
                            ) : (
                              <Badge kind="muted">
                                {days}d
                              </Badge>
                            )}
                          </div>
                          {sub.last_reminder_sent_at_v2 && (
                            <p className="mt-1 text-[11px] text-ink-3">
                              Last reminder: {formatDate(sub.last_reminder_sent_at_v2)}
                            </p>
                          )}
                        </td>

                        {/* MRR */}
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-ink">
                          {rupee(sub.mrr)}
                        </td>

                        {/* Cadence (renewal_state from automation) */}
                        <td className="px-4 py-3">
                          <Badge kind={renewalStateTone(sub.renewal_state)} dot>
                            {renewalStateLabel(sub.renewal_state)}
                          </Badge>
                          {sub.reminder_count > 0 && (
                            <p className="mt-1 text-[11px] text-ink-3 tabular-nums">
                              {sub.reminder_count} email{sub.reminder_count === 1 ? "" : "s"} sent
                            </p>
                          )}
                          {days < 0 && sub.renewal_state !== "suspended" && (
                            <p className="mt-1 text-[11px] font-medium text-rose-600">
                              Suspends in {Math.max(0, graceDays - Math.abs(days))}d
                            </p>
                          )}
                        </td>

                        {/* Churn risk */}
                        <td className="px-4 py-3">
                          <Badge kind={risk.badgeKind} dot>
                            {risk.label}
                          </Badge>
                          {risk.reasons.length > 0 && (
                            <p className="mt-1 max-w-[200px] text-xs leading-snug text-ink-3">
                              {risk.reasons[0]}
                              {risk.reasons.length > 1 && (
                                <span
                                  className={cn(
                                    "ml-1",
                                    risk.level === "high"
                                      ? "text-rose-600"
                                      : "text-amber-600",
                                  )}
                                >
                                  · +{risk.reasons.length - 1} more
                                </span>
                              )}
                            </p>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1.5">
                            <div className="flex items-center gap-1.5">
                              {sub.renewal_quote_id ? (
                                <Button
                                  asChild
                                  variant="default"
                                  size="sm"
                                  title="Open the existing renewal quote — edit seats/plan or send"
                                >
                                  <Link href={`/quotes/${sub.renewal_quote_id}` as never}>
                                    <Icon name="file" size={12} />
                                    Open quote
                                  </Link>
                                </Button>
                              ) : (
                                <Button
                                  variant={kind === "rose" ? "primary" : "default"}
                                  size="sm"
                                  loading={generating === sub.id}
                                  disabled={
                                    sub.renewal_state === "suspended" ||
                                    sub.renewal_state === "renewed"
                                  }
                                  onClick={() => handleGenerateQuote(sub)}
                                  title="Create the renewal quote now (early, e.g. customer asked 60 days ahead) — same logic as the T-15 cron auto-create"
                                >
                                  <Icon name="plus" size={12} />
                                  Generate quote
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={sending === sub.id}
                                disabled={
                                  sub.renewal_state === "suspended" ||
                                  sub.renewal_state === "renewed"
                                }
                                onClick={() => handleSendNow(sub)}
                                title="Send the appropriate renewal email immediately (overrides daily cron)"
                              >
                                <Icon name="mail" size={12} />
                                Send now
                              </Button>
                            </div>
                            {sub.renewal_quote_id && (
                              <p className="text-[11px] text-ink-3 font-mono">
                                Quote: {sub.renewal_quote_id}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RenewalsPage() {
  const { data: subs, isLoading, error } = useSubscriptions();
  const { data: me } = useCurrentUser();
  const graceDays = me?.tenantGracePeriodDays ?? 0;
  const today = new Date();

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="alert"
        title="Could not load renewals"
        body={error.message}
        action={
          <Button variant="default" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      />
    );
  }

  const all = subs ?? [];

  // Enrich with days-until-renewal (skip cancelled / no-date)
  const enriched = all
    .filter((s) => s.renewal_date !== null && s.status !== "cancelled")
    .map((s) => ({
      sub: s,
      daysUntil: daysBetween(today, s.renewal_date!),
    }));

  // Urgency buckets
  const urgent   = enriched.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 7);
  const upcoming = enriched.filter((r) => r.daysUntil > 7  && r.daysUntil <= 30);
  const future   = enriched.filter((r) => r.daysUntil > 30 && r.daysUntil <= 90);

  // KPI aggregates
  const urgentMrr   = urgent.reduce((s, r)   => s + r.sub.mrr, 0);
  const upcomingMrr = upcoming.reduce((s, r) => s + r.sub.mrr, 0);
  const futureMrr   = future.reduce((s, r)   => s + r.sub.mrr, 0);
  const arrAtRisk   = [...urgent, ...upcoming, ...future].reduce(
    (s, r) => s + r.sub.mrr * 12,
    0,
  );

  const upcoming90   = enriched.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 90);
  const highRiskSubs = upcoming90.filter((r) => renewalRisk(r.sub).level === "high");
  const highRiskArr  = highRiskSubs.reduce((s, r) => s + r.sub.mrr * 12, 0);

  const activeSubs    = all.filter((s) => s.status === "active").length;
  const topHighRisk   = highRiskSubs[0]?.sub.customer_name ?? "a key customer";
  const firstUpcoming = upcoming[0];

  return (
    <div className="mx-auto max-w-screen-xl px-8 pb-20 pt-7">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-ink-3">
            Revenue
          </p>
          <h1 className="font-serif text-3xl text-ink">Renewals</h1>
          <p className="mt-1 text-sm text-ink-3">
            {activeSubs} active subscription{activeSubs !== 1 ? "s" : ""}
            {arrAtRisk > 0 && (
              <>
                {" · "}
                <span className="font-medium text-rose-600">
                  {rupee(arrAtRisk, { compact: true })} ARR at risk
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => toast.info("Export coming soon")}
          >
            <Icon name="download" size={14} />
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              toast.success("Bulk reminder sent to all customers renewing in 30 days")
            }
          >
            <Icon name="mail" size={14} />
            Bulk reminder
          </Button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KPI
          label="Urgent · ≤7 days"
          value={urgent.length}
          trend={`${rupee(urgentMrr, { compact: true })} MRR`}
          trendKind="down"
          icon="clock"
        />
        <KPI
          label="Upcoming · 30 days"
          value={upcoming.length}
          trend={`${rupee(upcomingMrr, { compact: true })} MRR`}
          trendKind="neutral"
          icon="calendar"
        />
        <KPI
          label="Future · 31–90 days"
          value={future.length}
          trend={`${rupee(futureMrr, { compact: true })} MRR`}
          trendKind="up"
          icon="trending_up"
        />
        <KPI
          label="High-risk renewals"
          value={highRiskSubs.length}
          trend={`${rupee(highRiskArr, { compact: true })} ARR at risk`}
          trendKind="down"
          icon="alert"
        />
        <KPI
          label="Renewal rate"
          value="87"
          unit="%"
          trend="+5% YoY"
          trendKind="up"
          icon="check_circle"
        />
      </div>

      {/* ── Gemini AI next-best-actions ── */}
      {highRiskSubs.length > 0 && (
        <div className="mb-6">
          <GeminiCard
            title="Renewal AI · Next best actions"
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    toast.success(`Save call scheduled for ${topHighRisk}`)
                  }
                >
                  <Icon name="phone" size={12} />
                  Save {topHighRisk}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    toast.success("NPS survey sent to medium-risk customers")
                  }
                >
                  <Icon name="mail" size={12} />
                  Send NPS to medium-risk
                </Button>
              </div>
            }
          >
            <strong className="text-ink">
              {highRiskSubs.length} high-risk renewal
              {highRiskSubs.length !== 1 ? "s" : ""} worth{" "}
              {rupee(highRiskArr, { compact: true })} ARR detected.
            </strong>{" "}
            Top priority: <strong>{topHighRisk}</strong> — low seat usage + poor NPS.
            Call this week with a usage report and upgrade incentive.
            {firstUpcoming && (
              <>
                {" "}
                <strong>{firstUpcoming.sub.customer_name}</strong> renews in{" "}
                {firstUpcoming.daysUntil} days — try WhatsApp if no email response.
              </>
            )}
          </GeminiCard>
        </div>
      )}

      {/* ── Renewal buckets ── */}
      <div className="space-y-5">
        <RenewalBucket
          kind="rose"
          title="Urgent · Next 7 days"
          subtitle="Call within 24 hours — every day of delay risks revenue"
          rows={urgent}
          graceDays={graceDays}
          defaultOpen
        />
        <RenewalBucket
          kind="amber"
          title="Upcoming · Next 30 days"
          subtitle="Send personalised email + one follow-up call"
          rows={upcoming}
          graceDays={graceDays}
          defaultOpen
        />
        <RenewalBucket
          kind="emerald"
          title="Future · 31–90 days"
          subtitle="Drip campaign + value-prop content"
          rows={future}
          graceDays={graceDays}
          defaultOpen={false}
        />
      </div>
    </div>
  );
}
