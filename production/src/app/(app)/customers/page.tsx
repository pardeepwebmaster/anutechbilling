/**
 * Customers — list matching prototype design.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCustomers } from "@/lib/queries/customers";
import { useSubscriptions } from "@/lib/queries/subscriptions";
import { useOutstandingReceivables } from "@/lib/queries/payments";
import { effectiveHealth } from "@/lib/utils";
import { AddCustomerForm } from "@/components/features/customers/add-customer-form";
import { EmptyState } from "@/components/shared/empty-state";
import { KPI } from "@/components/shared/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate, cn } from "@/lib/utils";

export default function CustomersPage() {
  const router = useRouter();
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const { data: subscriptions } = useSubscriptions();
  const { data: outstanding } = useOutstandingReceivables();

  // Map: customer_id → max days outstanding (worst case across all their subs)
  const outstandingByCustomer = React.useMemo(() => {
    const map = new Map<string, { days: number; amount: number }>();
    for (const o of outstanding ?? []) {
      if (!o.customer_id) continue;
      const prev = map.get(o.customer_id);
      if (!prev || o.days_outstanding > prev.days) {
        map.set(o.customer_id, { days: o.days_outstanding, amount: o.outstanding_amount });
      }
    }
    return map;
  }, [outstanding]);

  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  // Aggregate MRR + nearest renewal per customer from subscriptions
  const subsByCustomer = React.useMemo(() => {
    const map = new Map<string, { mrr: number; arr: number; renewal: string | null }>();
    for (const s of subscriptions ?? []) {
      if (!s.customer_id || s.status !== "active") continue;
      const prev = map.get(s.customer_id) ?? { mrr: 0, arr: 0, renewal: null };
      map.set(s.customer_id, {
        mrr: prev.mrr + s.mrr,
        arr: prev.arr + s.mrr * 12,
        renewal:
          !prev.renewal || (s.renewal_date && s.renewal_date < prev.renewal)
            ? s.renewal_date
            : prev.renewal,
      });
    }
    return map;
  }, [subscriptions]);

  // Filter
  const filtered = (customers ?? []).filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.domain?.toLowerCase().includes(s) ?? false) ||
      (c.contact_name?.toLowerCase().includes(s) ?? false) ||
      (c.contact_email?.toLowerCase().includes(s) ?? false)
    );
  });

  // KPIs
  const total = customers?.length ?? 0;
  const totalMRR = Array.from(subsByCustomer.values()).reduce((s, x) => s + x.mrr, 0);
  const totalARR = totalMRR * 12;
  const avgHealth =
    customers && customers.length > 0
      ? Math.round(
          customers.reduce((s, c) => {
            const out = outstandingByCustomer.get(c.id);
            return s + effectiveHealth(c.health, out?.days);
          }, 0) / customers.length,
        )
      : 0;
  const atRisk = (customers ?? []).filter((c) => {
    const out = outstandingByCustomer.get(c.id);
    return effectiveHealth(c.health, out?.days) < 75;
  }).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Workspace</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Customers</h1>
          {!isLoading && customers && (
            <p className="text-sm text-ink-3 mt-1 tabular-nums">
              <b>{total}</b> active customer{total === 1 ? "" : "s"}
              {totalARR > 0 && <> · <b>{rupee(totalARR, { compact: true })}</b> ARR</>}
              {customers.length > 0 && <> · Avg health <b>{avgHealth}</b>/100</>}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="download">Export</Button>
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
            Add customer
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && customers && customers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPI label="Active customers" value={total} icon="users" />
          <KPI label="Total MRR"         value={rupee(totalMRR, { compact: true })} icon="rupee" />
          <KPI label="Total ARR"         value={rupee(totalARR, { compact: true })} icon="trending_up" />
          <KPI
            label="At-risk accounts"
            value={atRisk}
            trend={atRisk > 0 ? "needs attention" : "all healthy"}
            trendKind={atRisk > 0 ? "down" : "up"}
            trendIcon={atRisk > 0 ? "alert" : "check_circle"}
            icon="alert"
          />
        </div>
      )}

      {/* Filter row */}
      {!isLoading && customers && customers.length > 0 && (
        <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
          <div className="text-xs text-ink-3">
            Showing {filtered.length} of {total} customers
          </div>
          <div className="w-72">
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
          title="Could not load customers"
          body={error.message}
          action={<Button icon="refresh" onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <Card flush>
          <table className="w-full">
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
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
      {!isLoading && !error && customers && customers.length === 0 && (
        <EmptyState
          icon="users"
          title="No customers yet"
          body="Add your first customer to start tracking subscriptions, invoices, and renewals."
          action={<Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add your first customer</Button>}
          secondary={<Button icon="download">Import CSV</Button>}
        />
      )}

      {/* Table */}
      {!isLoading && !error && filtered.length > 0 && (
        <>
          <Card flush>
            <table className="w-full">
              <thead className="bg-paper-2 border-b border-hairline">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Customer</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Since</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">State</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">MRR</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">ARR</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Health</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Renewal</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Manager</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const sub = subsByCustomer.get(c.id);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}` as any)}
                      className="border-b border-hairline last:border-0 hover:bg-paper-2/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-medium text-sm text-ink">{c.name}</div>
                        {c.domain && (
                          <div className="text-[11px] text-ink-3 font-mono mt-0.5">{c.domain}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-ink-2">{formatDate(c.since)}</td>
                      <td className="p-3 text-xs text-ink-2">{c.state || "—"}</td>
                      <td className="p-3 text-right tabular-nums text-sm">
                        {sub ? rupee(sub.mrr) : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="p-3 text-right tabular-nums text-sm font-medium">
                        {sub ? rupee(sub.arr, { compact: true }) : <span className="text-ink-3 font-normal">—</span>}
                      </td>
                      <td className="p-3 text-right">
                        {(() => {
                          const out = outstandingByCustomer.get(c.id);
                          const eff = effectiveHealth(c.health, out?.days);
                          const dropped = eff < c.health;
                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={cn(
                                  "tabular-nums text-sm font-medium",
                                  dropped && "text-rose"
                                )}>{eff}</span>
                                <HealthBadge value={eff} />
                              </div>
                              {dropped && (
                                <span className="text-[9px] text-rose-soft-fg text-ink-3 line-through tabular-nums">{c.health}</span>
                              )}
                              {out && (
                                <span className="text-[10px] text-rose tabular-nums" title={`${out.days} days outstanding`}>
                                  {rupee(out.amount, { compact: true })} due {out.days}d
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-sm text-ink-2">
                        {sub?.renewal ? formatDate(sub.renewal) : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar initials="PA" color="amber" size="sm" />
                          <span className="text-xs">Pardeep</span>
                        </div>
                      </td>
                      <td className="p-3 text-ink-3">
                        <Icon name="chevron_right" size={14} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Help text */}
          <div className="flex items-center gap-1.5 text-xs text-ink-3 mt-3">
            <Icon name="info" size={11} />
            Click any row to open the Customer 360 view with full activity timeline, subscriptions, and contacts.
          </div>
        </>
      )}

      {/* Search empty */}
      {!isLoading && !error && customers && customers.length > 0 && filtered.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="search"
            title="No customers match"
            body={`No results for "${search}". Try a different search term.`}
            action={<Button icon="x" onClick={() => setSearch("")}>Clear search</Button>}
            compact
          />
        </div>
      )}

      {/* Add customer modal */}
      <AddCustomerForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

// ============================================================
// Health badge — matches prototype healthBadge()
// ============================================================
function HealthBadge({ value }: { value: number }) {
  if (value >= 85) return <Badge kind="success" dot>Healthy</Badge>;
  if (value >= 70) return <Badge kind="warning" dot>Watch</Badge>;
  return <Badge kind="danger" dot>At risk</Badge>;
}
