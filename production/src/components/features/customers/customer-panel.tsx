"use client";

/**
 * CustomerPanel — right-hand detail pane for the Customers master-detail layout,
 * "answers-first" (beats the accountant-first Zoho layout). Composes the shared
 * customer-insights building blocks so it stays byte-for-byte consistent with the
 * full /customers/[id] 360 page (same Outstanding / MRR / Next-best-action).
 *
 * Human-psychology ordering — the brain asks 3 things on open:
 *   1. WHO + can I reach them?  → identity header + contact actions
 *   2. Healthy / do they owe?   → answer-bar (4 real KPIs)
 *   3. What do I do NEXT?       → next-best-action card
 * Then subscriptions (the heart) and, behind light tabs, secondary detail.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useCustomer } from "@/lib/queries/customers";
import { useCustomerSubscriptions } from "@/lib/queries/subscriptions";
import { useCustomerInvoices, useCustomerQuotes } from "@/lib/queries/invoices";
import { useCustomerProjects } from "@/lib/queries/projects";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { initials, formatDate, rupee, daysBetween } from "@/lib/utils";
import { AddCustomerForm } from "./add-customer-form";
import {
  deriveCustomerInsights,
  CustomerMetricBar,
  NextBestActionCard,
  CustomerContactActions,
  SubscriptionList,
  CustomerActivity,
  CustomerDetailsGrid,
  PanelEmpty,
} from "./customer-insights";

export function CustomerPanel({ customerId, onClose }: { customerId: string; onClose?: () => void }) {
  const router = useRouter();
  const { data: c, isLoading } = useCustomer(customerId);
  const { data: subs } = useCustomerSubscriptions(customerId);
  const { data: invoices } = useCustomerInvoices(customerId);
  const { data: quotes } = useCustomerQuotes(customerId);
  const { data: projects } = useCustomerProjects(customerId);
  const [tab, setTab] = React.useState("activity");
  const [editOpen, setEditOpen] = React.useState(false);

  React.useEffect(() => { setTab("activity"); }, [customerId]);

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!c) {
    return <div className="p-8 text-center text-sm text-ink-3">Customer not found.</div>;
  }

  const allSubs = subs ?? [];
  const allInvoices = invoices ?? [];
  const allQuotes = quotes ?? [];
  const insights = deriveCustomerInsights(c, allSubs, allInvoices);

  const tenureDays = daysBetween(c.since, new Date());
  const tenure =
    tenureDays >= 365 ? `${Math.floor(tenureDays / 365)}y ${Math.floor((tenureDays % 365) / 30)}mo`
    : tenureDays >= 30 ? `${Math.floor(tenureDays / 30)}mo`
    : `${Math.max(tenureDays, 0)}d`;
  const healthKind = c.health >= 85 ? "success" : c.health >= 70 ? "warning" : "danger";
  const healthLabel = c.health >= 85 ? "Healthy" : c.health >= 70 ? "Watch" : "At risk";

  const tabs: TabBarItem[] = [
    { id: "activity", label: "Activity" },
    { id: "invoices", label: "Invoices", count: allInvoices.length || undefined },
    { id: "quotes",   label: "Quotes",   count: (allQuotes.length + (projects ?? []).length) || undefined },
    { id: "details",  label: "Details" },
  ];
  const custProjects = projects ?? [];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 1. Identity header */}
      <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={initials(c.name) || "?"} color="amber" size="md" />
          <div className="min-w-0">
            <h2 className="font-serif text-2xl text-ink leading-tight truncate">{c.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge kind={healthKind} dot>{healthLabel} · {c.health}</Badge>
              <span className="text-[11px] text-ink-3">Customer for {tenure}</span>
              {c.domain && <span className="text-[11px] text-ink-3 font-mono truncate">· {c.domain}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <IconButton icon="edit" aria-label="Edit customer" onClick={() => setEditOpen(true)} />
          <Button size="sm" variant="default" icon="external" onClick={() => router.push(`/customers/${c.id}` as never)}>Open full</Button>
          {onClose && <IconButton icon="x" aria-label="Close" onClick={onClose} />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <CustomerContactActions customer={c} />

        {/* 2. Answer-bar */}
        <CustomerMetricBar insights={insights} />

        {/* 3. Next-best-action */}
        <NextBestActionCard nba={insights.nba} customer={c} />

        {/* 4. Subscriptions & projects — ongoing revenue relationships */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Subscriptions & projects</span>
            {(allSubs.length + custProjects.length) > 0 && <span className="text-[10px] text-ink-3 tabular-nums">({allSubs.length + custProjects.length})</span>}
          </div>
          <SubscriptionList subs={allSubs} />
          {custProjects.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {custProjects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}` as never} className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-paper px-3 py-2 hover:border-hairline-strong transition-colors">
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon name="package" size={14} className="text-ink-3 shrink-0" />
                      <span className="min-w-0">
                        <span className="text-sm text-ink truncate block">{p.title}</span>
                        <span className="text-[11px] text-ink-3">Project · {p.receivable > 0 ? `${rupee(p.receivable)} outstanding` : "fully paid"}</span>
                      </span>
                    </span>
                    <Badge kind={p.status === "completed" ? "success" : p.status === "cancelled" ? "muted" : p.status === "quoted" ? "info" : "warning"} size="sm" dot>
                      {p.status === "quoted" ? "Quotation" : p.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 5. Secondary detail — progressive disclosure */}
        <section>
          <TabBar value={tab} onChange={setTab} items={tabs} />
          <div className="pt-4">
            {tab === "activity" && <CustomerActivity subs={allSubs} invoices={allInvoices} quotes={allQuotes} limit={10} />}
            {tab === "invoices" && (
              allInvoices.length > 0 ? (
                <SimpleTable
                  head={["Invoice", "Date", "Amount", "Status"]}
                  rows={allInvoices.map((i) => [
                    i.id, formatDate(i.invoice_date), rupee(i.amount),
                    <Badge key="b" kind={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : "warning"} dot>{i.status}</Badge>,
                  ])}
                />
              ) : <PanelEmpty icon="receipt" text="No invoices yet." />
            )}
            {tab === "quotes" && (
              (allQuotes.length + custProjects.length) > 0 ? (
                <SimpleTable
                  head={["Quote / Project", "Type", "Amount", "Status"]}
                  rows={[
                    ...allQuotes.map((q) => [
                      q.id, "Subscription", rupee(q.amount),
                      <Badge key="b" kind="info" dot>{q.status}</Badge>,
                    ]),
                    ...custProjects.map((p) => [
                      p.title, "Project", rupee(p.total_amount),
                      <Badge key="b" kind={p.status === "completed" ? "success" : p.status === "cancelled" ? "muted" : p.status === "quoted" ? "info" : "warning"} dot>
                        {p.status === "quoted" ? "Quotation" : p.status}
                      </Badge>,
                    ]),
                  ]}
                />
              ) : <PanelEmpty icon="file" text="No quotes yet." />
            )}
            {tab === "details" && <CustomerDetailsGrid c={c} />}
          </div>
        </section>
      </div>

      <AddCustomerForm open={editOpen} onOpenChange={setEditOpen} customer={c} />
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="border border-hairline rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper-2/50">
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-ink-3 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-paper-2/30">
              {r.map((cell, j) => <td key={j} className="px-3 py-2 text-ink-2">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
