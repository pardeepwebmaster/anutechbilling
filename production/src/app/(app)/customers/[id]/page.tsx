/**
 * Customer 360 — full detail page, "answers-first" (same blueprint as the
 * master-detail CustomerPanel, composed from the shared customer-insights
 * building blocks so the two surfaces never drift).
 *
 * Removed the old fake data: stub "Customer added" activity, hardcoded
 * "Account manager: Pardeep Sharma", and dead Note/Log-call/New-activity
 * buttons. Everything here is now derived from real rows (compass: no
 * fabricated numbers, no fake timeline).
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useCustomer } from "@/lib/queries/customers";
import { useCustomerSubscriptions } from "@/lib/queries/subscriptions";
import { useCustomerInvoices, useCustomerQuotes } from "@/lib/queries/invoices";
import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icon";
import { formatDate, formatPhone, rupee, daysBetween, cn } from "@/lib/utils";
import {
  deriveCustomerInsights,
  CustomerMetricBar,
  NextBestActionCard,
  CustomerContactActions,
  SubscriptionList,
  CustomerActivity,
  CustomerDetailsGrid,
} from "@/components/features/customers/customer-insights";
import { AddCustomerForm } from "@/components/features/customers/add-customer-form";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: customer, isLoading, error } = useCustomer(params.id);
  const { data: subs }     = useCustomerSubscriptions(params.id);
  const { data: invoices } = useCustomerInvoices(params.id);
  const { data: quotes }   = useCustomerQuotes(params.id);

  const [tab, setTab] = React.useState("activity");
  const [editOpen, setEditOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 max-w-[1240px] mx-auto">
        <EmptyState
          icon="alert"
          title={error ? "Could not load customer" : "Customer not found"}
          body={error?.message ?? "This customer does not exist in your tenant."}
          action={
            <Button asChild variant="primary" icon="users">
              <Link href={"/customers" as any}>Back to customers</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const c = customer;
  const allSubs = subs ?? [];
  const allInvoices = invoices ?? [];
  const allQuotes = quotes ?? [];
  const insights = deriveCustomerInsights(c, allSubs, allInvoices);

  const tenureDays = daysBetween(c.since, new Date());
  const tenure =
    tenureDays >= 365 ? `${Math.floor(tenureDays / 365)}y ${Math.floor((tenureDays % 365) / 30)}mo`
    : tenureDays >= 30 ? `${Math.floor(tenureDays / 30)}mo`
    : `${Math.max(tenureDays, 0)}d`;

  const healthBadgeKind = c.health >= 85 ? "success" : c.health >= 70 ? "warning" : "danger";
  const healthLabel = c.health >= 85 ? "Healthy" : c.health >= 70 ? "Watch" : "At risk";
  const healthColor = c.health >= 85 ? "text-emerald" : c.health >= 70 ? "text-amber-ink" : "text-rose";

  const tabs: TabBarItem[] = [
    { id: "activity", label: "Activity" },
    { id: "subscriptions", label: "Subscriptions", count: allSubs.length || undefined },
    { id: "quotes", label: "Quotes", count: allQuotes.length || undefined },
    { id: "invoices", label: "Invoices", count: allInvoices.length || undefined },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto">
      {/* Header — identity + real contact actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <IconButton icon="arrow_left" aria-label="Back" onClick={() => router.push("/customers" as any)} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">
              Customer · since {formatDate(c.since)} · {tenure}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">{c.name}</h1>
            {/* Contact line under the company name — person + mobile + email, tappable */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {c.contact_name && (
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <Icon name="user" size={13} className="text-ink-3" />
                  {c.contact_name}
                </span>
              )}
              {c.contact_phone && (
                <a
                  href={`tel:${c.contact_phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 text-ink-2 hover:text-amber-ink transition-colors"
                >
                  <Icon name="phone" size={13} className="text-ink-3" />
                  <span className="tabular-nums">{formatPhone(c.contact_phone)}</span>
                </a>
              )}
              {c.contact_email && (
                <a
                  href={`mailto:${c.contact_email}`}
                  className="inline-flex items-center gap-1.5 text-ink-2 hover:text-amber-ink transition-colors"
                >
                  <Icon name="mail" size={13} className="text-ink-3" />
                  <span className="font-mono text-xs">{c.contact_email}</span>
                </a>
              )}
              {(c.domain || c.state) && (
                <span className="inline-flex items-center gap-1.5 text-ink-3">
                  {c.domain && <span className="font-mono text-xs">{c.domain}</span>}
                  {c.domain && c.state && <span>·</span>}
                  {c.state && <span>{c.state}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <CustomerContactActions customer={c} />
          <Button icon="edit" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="primary" icon="plus" onClick={() => router.push("/quotes/new" as any)}>New quote</Button>
        </div>
      </div>

      {/* Answer-bar */}
      <div className="mb-4">
        <CustomerMetricBar insights={insights} />
      </div>

      {/* Next-best-action */}
      <div className="mb-6">
        <NextBestActionCard nba={insights.nba} customer={c} />
      </div>

      {/* Body — relationship left, status/detail right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* LEFT */}
        <div className="space-y-4">
          <Card title="Subscriptions" sub={allSubs.length > 0 ? `${insights.activeSubs.length} active` : undefined}>
            <SubscriptionList subs={allSubs} />
          </Card>

          <Card flush>
            <div className="px-4 pt-3">
              <TabBar value={tab} onChange={setTab} items={tabs} />
            </div>
            <div className="p-4">
              {tab === "activity" && <CustomerActivity subs={allSubs} invoices={allInvoices} quotes={allQuotes} limit={15} />}
              {tab === "subscriptions" && <SubscriptionList subs={allSubs} />}
              {tab === "quotes" && (
                allQuotes.length > 0 ? (
                  <RecordTable
                    head={["Quote", "Plan", "Seats", "Amount", "Status", "Created"]}
                    rows={allQuotes.map((q) => ({
                      onClick: () => router.push(`/quotes/${q.id}` as any),
                      cells: [
                        <span key="id" className="font-mono text-xs">{q.id}</span>,
                        q.plan ?? "—",
                        <span key="s" className="tabular-nums">{q.seats ?? "—"}</span>,
                        <span key="a" className="tabular-nums font-medium">{rupee(q.amount)}</span>,
                        <Badge key="b" kind="info" dot>{q.status}</Badge>,
                        formatDate(q.created_date),
                      ],
                    }))}
                  />
                ) : <EmptyState icon="file" title="No quotes yet" body="Create the first quote for this customer." compact
                      action={<Button variant="primary" icon="plus" onClick={() => router.push("/quotes/new" as any)}>New quote</Button>} />
              )}
              {tab === "invoices" && (
                allInvoices.length > 0 ? (
                  <RecordTable
                    head={["Invoice", "Date", "Due", "Amount", "Status"]}
                    rows={allInvoices.map((i) => ({
                      cells: [
                        <span key="id" className="font-mono text-xs">{i.id}</span>,
                        formatDate(i.invoice_date),
                        i.due_date ? formatDate(i.due_date) : "—",
                        <span key="a" className="tabular-nums font-medium">{rupee(i.amount)}</span>,
                        <Badge key="b" kind={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : "warning"} dot>{i.status}</Badge>,
                      ],
                    }))}
                  />
                ) : <EmptyState icon="receipt" title="No invoices yet" body="Invoices generate automatically when a quote is accepted + paid." compact />
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <Card title="Health">
            <div className="text-center py-2 pb-4">
              <div className={cn("font-serif text-6xl leading-none", healthColor)}>
                {c.health}<span className="text-2xl text-ink-3">/100</span>
              </div>
              <div className="mt-3"><Badge kind={healthBadgeKind} dot>{healthLabel}</Badge></div>
              <p className="text-[11px] text-ink-3 mt-2">Customer for {tenure}</p>
            </div>
          </Card>

          <Card title="Details">
            <CustomerDetailsGrid c={c} />
          </Card>
        </div>
      </div>

      <AddCustomerForm open={editOpen} onOpenChange={setEditOpen} customer={c} />
    </div>
  );
}

// Clickable record table for the Quotes / Invoices tabs.
function RecordTable({ head, rows }: { head: string[]; rows: { cells: React.ReactNode[]; onClick?: () => void }[] }) {
  return (
    <div className="border border-hairline rounded-md overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper-2/50">
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-ink-3 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r, i) => (
            <tr
              key={i}
              onClick={r.onClick}
              className={cn("hover:bg-paper-2/30", r.onClick && "cursor-pointer")}
            >
              {r.cells.map((cell, j) => <td key={j} className="px-3 py-2 text-ink-2 whitespace-nowrap">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
