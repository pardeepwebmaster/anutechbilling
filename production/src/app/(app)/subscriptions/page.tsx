/**
 * Subscriptions — list matching prototype design.
 */
"use client";

import * as React from "react";
import { useSubscriptions } from "@/lib/queries/subscriptions";
import { toast } from "sonner";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { KPI } from "@/components/shared/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate, daysBetween } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Subscription } from "@/lib/supabase/database.types";

// Margin estimate per subscription (until items linked)
function estimateMargin(s: Subscription) {
  // Heuristic: ~17% margin on typical reseller subs
  const cost = Math.round(s.mrr * 0.83);
  return { margin: s.mrr - cost, marginPct: Math.round(((s.mrr - cost) / s.mrr) * 100), cost };
}

export default function SubscriptionsPage() {
  const { data: subs, isLoading, error, refetch } = useSubscriptions();
  const [tab, setTab] = React.useState("all");
  const [vendor, setVendor] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const today = new Date();
  const daysUntil = (renewal: string | null) =>
    renewal ? daysBetween(today, renewal) : null;

  // Filter
  const filtered = (subs ?? []).filter((s) => {
    const dl = daysUntil(s.renewal_date);
    if (tab === "active" && s.status !== "active") return false;
    if (tab === "expiring" && (dl === null || dl < 0 || dl > 30)) return false;
    if (tab === "expired" && s.status !== "expired") return false;
    if (vendor !== "all" && s.vendor !== vendor) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !s.customer_name.toLowerCase().includes(q) &&
        !(s.domain?.toLowerCase().includes(q) ?? false) &&
        !s.plan.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Counts
  const counts = {
    all: subs?.length ?? 0,
    active: (subs ?? []).filter((s) => s.status === "active").length,
    expiring: (subs ?? []).filter((s) => {
      const dl = daysUntil(s.renewal_date);
      return dl !== null && dl >= 0 && dl <= 30;
    }).length,
    expired: (subs ?? []).filter((s) => s.status === "expired").length,
  };

  const tabs: TabBarItem[] = [
    { id: "all",      label: "All",          count: counts.all },
    { id: "active",   label: "Active",       count: counts.active, dot: "emerald" },
    { id: "expiring", label: "Expiring 30d", count: counts.expiring, dot: "amber" },
    { id: "expired",  label: "Expired",      count: counts.expired, dot: "rose" },
  ];

  // KPIs
  const activeSubs = (subs ?? []).filter((s) => s.status === "active");
  const activeMRR = activeSubs.reduce((s, x) => s + x.mrr, 0);
  const activeARR = activeMRR * 12;
  const totalSeats = activeSubs.reduce((s, x) => s + x.seats, 0);
  const usedSeats = activeSubs.reduce((s, x) => s + x.used, 0);
  const monthlyMargin = activeSubs.reduce((acc, s) => acc + estimateMargin(s).margin, 0);
  const annualMargin = monthlyMargin * 12;
  const avgMarginPct = activeSubs.length > 0
    ? Math.round(activeSubs.reduce((a, s) => a + estimateMargin(s).marginPct, 0) / activeSubs.length)
    : 0;
  const atRiskCount = (subs ?? []).filter((s) => {
    const dl = daysUntil(s.renewal_date);
    return s.status === "active" && dl !== null && dl >= 0 && dl <= 30;
  }).length;
  const atRiskMRR = (subs ?? []).filter((s) => {
    const dl = daysUntil(s.renewal_date);
    return s.status === "active" && dl !== null && dl >= 0 && dl <= 30;
  }).reduce((s, x) => s + x.mrr, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Revenue</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Subscriptions</h1>
          <p className="text-sm text-ink-3 mt-1">All active + expired across vendors</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="refresh" onClick={() => toast.info("Vendor sync coming in Phase 2")}>Sync vendors</Button>
          <Button icon="download">Export</Button>
          <Button variant="primary" icon="plus" onClick={() => toast.info("Subscriptions are created from accepted quotes")}>
            Manual add
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && subs && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <KPI label="Total subs"        value={counts.all} trend={`${counts.active} active`} trendKind="up" />
          <KPI label="Active MRR"        value={rupee(activeMRR, { compact: true })} icon="rupee" />
          <KPI label="Active ARR"        value={rupee(activeARR, { compact: true })} trendKind="up" trendIcon="trending_up" />
          <KPI label="Your Margin (ARR)" value={rupee(annualMargin, { compact: true })} trend={`Avg ${avgMarginPct}%`} trendKind="up" icon="rupee" />
          <KPI label="Total seats"       value={totalSeats} trend={`${usedSeats} used`} />
          <KPI label="At risk"           value={atRiskCount} trend={rupee(atRiskMRR, { compact: true }) + " MRR"} trendKind="down" trendIcon="alert" />
        </div>
      )}

      {/* AI suggestion */}
      {!isLoading && subs && atRiskCount > 0 && (
        <div className="mb-4">
          <GeminiCard
            title="Renewal intelligence"
            actions={
              <Button size="sm" variant="primary" icon="mail">Bulk renewal email</Button>
            }
            compact
          >
            <b>{atRiskCount} subscription{atRiskCount === 1 ? "" : "s"} expiring in next 30 days.</b>{" "}
            Worth {rupee(atRiskMRR, { compact: true })} MRR — start renewal conversations now.
          </GeminiCard>
        </div>
      )}

      {/* Tabs */}
      {!isLoading && subs && subs.length > 0 && (
        <div className="mb-3">
          <TabBar value={tab} onChange={setTab} items={tabs} />
        </div>
      )}

      {/* Filter row */}
      {!isLoading && subs && subs.length > 0 && (
        <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
          <div className="inline-flex gap-1 bg-paper-2 rounded-md p-0.5">
            {[
              { value: "all", label: "All Vendors" },
              { value: "google", label: "Google" },
              { value: "microsoft", label: "Microsoft" },
              { value: "zoho", label: "Zoho" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVendor(opt.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  vendor === opt.value ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="w-64">
            <Input
              prefix={<Icon name="search" size={14} />}
              placeholder="Customer or domain…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="alert"
          title="Could not load subscriptions"
          body={error.message}
          action={<Button icon="refresh" onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <Card flush>
          <table className="w-full">
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-hairline">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <td key={j} className="p-3"><Skeleton className="h-3 w-full" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !error && subs && subs.length === 0 && (
        <EmptyState
          icon="refresh"
          title="No subscriptions yet"
          body="Subscriptions are created automatically when an accepted quote moves to provisioning. Start by creating a quote."
          action={
            <Button asChild variant="primary" icon="file">
              <a href="/quotes/new">Create a quote</a>
            </Button>
          }
        />
      )}

      {/* Mobile card list — phones only */}
      {!isLoading && !error && filtered.length > 0 && (
        <ul className="md:hidden space-y-2 mb-3">
          {filtered.map((s) => {
            const dl = daysUntil(s.renewal_date);
            return (
              <li key={s.id} className="bg-paper border border-hairline rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink truncate">{s.customer_name}</p>
                    {s.domain && <p className="font-mono text-[11px] text-ink-3 truncate mt-0.5">{s.domain}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-base tabular-nums text-ink">{rupee(s.mrr)}</p>
                    <p className="text-[10px] text-ink-3">/mo · {s.seats} seats</p>
                  </div>
                </div>
                <p className="text-xs text-ink-2 mb-2 truncate">{s.plan}</p>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-hairline/60 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      kind={
                        s.status === "active"    ? "success" :
                        s.status === "paused"    ? "warning" :
                        s.status === "cancelled" ? "danger"  : "muted"
                      }
                      size="sm"
                      dot
                    >
                      {s.status}
                    </Badge>
                    {dl !== null && dl >= 0 && dl <= 30 && (
                      <Badge kind={dl <= 7 ? "danger" : "warning"} size="sm">
                        {dl}d
                      </Badge>
                    )}
                  </div>
                  <span className="text-ink-3 tabular-nums">
                    {s.renewal_date ? formatDate(s.renewal_date) : "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Desktop table */}
      {!isLoading && !error && filtered.length > 0 && (
        <Card flush className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-paper-2 border-b border-hairline">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Customer · Domain</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Plan</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Vendor</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Seats</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">MRR</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider" title="Monthly margin">Margin</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Started</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Renewal</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const m = estimateMargin(s);
                  const dl = daysUntil(s.renewal_date);
                  const isUrgent = dl !== null && dl >= 0 && dl <= 30;
                  return (
                    <tr key={s.id} className="border-b border-hairline last:border-0 hover:bg-paper-2/40">
                      <td className="p-3">
                        <div className="font-medium text-sm text-ink">{s.customer_name}</div>
                        {s.domain && <div className="text-[11px] text-ink-3 font-mono">{s.domain}</div>}
                      </td>
                      <td className="p-3 text-sm text-ink-2">{s.plan}</td>
                      <td className="p-3">
                        <Badge kind={s.vendor === "google" ? "info" : s.vendor === "microsoft" ? "info" : "success"}>
                          {s.vendor}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums text-sm">
                        {s.seats}{" "}
                        <span className="text-ink-3 text-xs">({s.used})</span>
                      </td>
                      <td className="p-3 text-right tabular-nums text-sm">{rupee(s.mrr)}</td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "tabular-nums text-sm font-medium",
                            m.marginPct >= 18 ? "text-emerald" : m.marginPct >= 14 ? "text-amber-ink" : "text-rose"
                          )}>
                            {rupee(m.margin)}
                          </span>
                          <span className="text-[10px] text-ink-3 tabular-nums">{m.marginPct}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-ink-2">{s.start_date ? formatDate(s.start_date) : "—"}</td>
                      <td className="p-3 text-sm">
                        <div>{s.renewal_date ? formatDate(s.renewal_date) : "—"}</div>
                        {isUrgent && (
                          <div className="mt-0.5"><Badge kind="danger" dot>{dl}d</Badge></div>
                        )}
                      </td>
                      <td className="p-3">
                        {s.status === "expired" && dl !== null ? (
                          <Badge kind="danger" dot>Expired {Math.abs(dl)}d</Badge>
                        ) : s.status === "active" ? (
                          <Badge kind="success" dot>Active</Badge>
                        ) : (
                          <Badge kind="muted">{s.status}</Badge>
                        )}
                        {s.outstanding_amount > 0 && (
                          <div className="mt-1">
                            <Badge kind="warning" dot>
                              {rupee(s.outstanding_amount)} due
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {s.status === "expired" ? (
                          <Button size="sm" variant="danger" icon="alert">Action</Button>
                        ) : isUrgent ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="primary" icon="phone">Renew</Button>
                            <IconButton icon="plus" aria-label="Add seats" size="sm" title="Add seats (pro-rata)" />
                          </div>
                        ) : (
                          <Button size="sm" icon="plus">Seats</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Filtered empty */}
      {!isLoading && !error && subs && subs.length > 0 && filtered.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="search"
            title="No subscriptions match"
            body="Try changing tab, vendor filter, or search term."
            action={<Button icon="x" onClick={() => { setTab("all"); setVendor("all"); setSearch(""); }}>Clear filters</Button>}
            compact
          />
        </div>
      )}

      {/* Bottom cards */}
      {!isLoading && subs && subs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <Card title="Vendor Reconciliation" sub="Compare our records vs vendor APIs">
            <div className="space-y-3">
              <ReconRow vendor="Google Reseller API" status="Not configured" tone="warn" />
              <ReconRow vendor="Microsoft Partner Center" status="Not configured" tone="warn" />
              <ReconRow vendor="Zoho Partner Portal" status="Not configured" tone="warn" />
              <div className="flex justify-between items-center pt-3 border-t border-hairline">
                <span className="text-xs text-ink-3">Auto-sync</span>
                <Badge kind="warning" dot>Phase 2</Badge>
              </div>
            </div>
          </Card>

          <Card title="Subscriptions by Plan">
            {(() => {
              const byPlan = new Map<string, { count: number; mrr: number }>();
              for (const s of activeSubs) {
                const prev = byPlan.get(s.plan) ?? { count: 0, mrr: 0 };
                byPlan.set(s.plan, { count: prev.count + 1, mrr: prev.mrr + s.mrr });
              }
              const rows = Array.from(byPlan.entries()).sort(([, a], [, b]) => b.mrr - a.mrr);
              if (rows.length === 0) return <p className="text-xs italic text-ink-3 p-2">No active subscriptions.</p>;
              return (
                <div className="space-y-2">
                  {rows.map(([plan, info]) => (
                    <div key={plan} className="flex justify-between items-center text-sm">
                      <span className="truncate">{plan}</span>
                      <span className="tabular-nums text-ink-2">
                        {info.count} · {rupee(info.mrr, { compact: true })}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Reconciliation row
// ============================================================
function ReconRow({ vendor, status, tone }: { vendor: string; status: string; tone: "ok" | "warn" | "error" }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span>{vendor}</span>
      <span className={cn(
        "text-xs",
        tone === "ok" ? "text-emerald" : tone === "warn" ? "text-amber-ink" : "text-rose"
      )}>
        {status}
      </span>
    </div>
  );
}
