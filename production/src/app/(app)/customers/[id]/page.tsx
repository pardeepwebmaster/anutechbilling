/**
 * Customer 360 — detail page matching prototype design.
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
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { ActivityTimeline, type TimelineEvent } from "@/components/shared/activity-timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { initials, formatDate, rupee, daysBetween } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: customer, isLoading, error } = useCustomer(params.id);
  const { data: subs }     = useCustomerSubscriptions(params.id);
  const { data: invoices } = useCustomerInvoices(params.id);
  const { data: quotes }   = useCustomerQuotes(params.id);

  const [tab, setTab] = React.useState("overview");

  // Aggregates
  const activeSubs = (subs ?? []).filter((s) => s.status === "active");
  const totalMRR = activeSubs.reduce((s, x) => s + x.mrr, 0);
  const totalARR = totalMRR * 12;
  const nearestRenewal = activeSubs
    .map((s) => s.renewal_date)
    .filter(Boolean)
    .sort()[0] as string | undefined;
  const tenureDays = customer ? daysBetween(customer.since, new Date()) : 0;
  const tenureYears = Math.floor(tenureDays / 365);
  const tenureMonths = Math.floor((tenureDays % 365) / 30);

  // Tabs with counts
  const tabs: TabBarItem[] = [
    { id: "overview",      label: "Overview" },
    { id: "subscriptions", label: "Subscriptions", count: subs?.length ?? 0 },
    { id: "quotes",        label: "Quotes",        count: quotes?.length ?? 0 },
    { id: "invoices",      label: "Invoices",      count: invoices?.length ?? 0 },
    { id: "activities",    label: "Activity" },
    { id: "files",         label: "Files" },
  ];

  // Loading
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-48 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
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
  const healthBadgeKind = c.health >= 85 ? "success" : c.health >= 70 ? "warning" : "danger";
  const healthLabel    = c.health >= 85 ? "Healthy"  : c.health >= 70 ? "Watch"   : "At risk";
  const healthColor    = c.health >= 85 ? "text-emerald" : c.health >= 70 ? "text-amber-ink" : "text-rose";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-start gap-4 min-w-0">
          <IconButton icon="arrow_left" aria-label="Back" onClick={() => router.push("/customers" as any)} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">
              Customer · since {formatDate(c.since)}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">{c.name}</h1>
            <p className="text-sm text-ink-3 mt-1">
              {c.domain && <span className="font-mono">{c.domain}</span>}
              {c.domain && c.state && <span> · </span>}
              {c.state && <span>{c.state}</span>}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button icon="message">Note</Button>
          <Button icon="phone">Log call</Button>
          <Button icon="edit">Edit</Button>
          <Button variant="primary" icon="plus">New activity</Button>
        </div>
      </div>

      {/* Top cards: Business Information (2fr) + Health & Revenue (1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
        <Card title="Business Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Stat label="Legal name" value={c.name} />
            <Stat label="Domain" value={c.domain} mono />
            <Stat label="GSTIN" value={c.gstin} mono />
            <Stat label="State" value={c.state} />
            <Stat
              label="Primary contact"
              value={c.contact_name ? `${c.contact_name}${c.contact_title ? ` · ${c.contact_title}` : ""}` : null}
            />
            <Stat label="Email" value={c.contact_email} mono />
            <Stat label="Phone" value={c.contact_phone} mono />
            <Stat label="Account manager" value="Pardeep Sharma" />
          </div>
        </Card>

        <Card title="Health & Revenue">
          <div className="text-center py-2 pb-4">
            <div className={cn("font-serif text-6xl leading-none", healthColor)}>
              {c.health}
              <span className="text-2xl text-ink-3">/100</span>
            </div>
            <div className="mt-3">
              <Badge kind={healthBadgeKind} dot>{healthLabel}</Badge>
            </div>
          </div>
          <div className="space-y-2 pt-4 border-t border-hairline">
            <KVRow label="MRR" value={totalMRR > 0 ? rupee(totalMRR) : "—"} />
            <KVRow label="ARR" value={totalARR > 0 ? rupee(totalARR, { compact: true }) : "—"} />
            <KVRow label="Renewal" value={nearestRenewal ? formatDate(nearestRenewal) : "—"} />
            <KVRow
              label="Tenure"
              value={
                tenureYears > 0
                  ? `${tenureYears}y ${tenureMonths}mo`
                  : tenureMonths > 0
                    ? `${tenureMonths}mo`
                    : `${tenureDays}d`
              }
            />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <TabBar value={tab} onChange={setTab} items={tabs} />
      </div>

      {/* OVERVIEW tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <Card
            title="Recent Activity"
            sub="Last 30 days"
            actions={
              <Button size="sm" variant="ghost" iconRight="arrow_right" onClick={() => setTab("activities")}>
                See all
              </Button>
            }
          >
            <ActivityTimeline events={buildStubActivity(c.name, c.created_at, c.since)} />
          </Card>

          <div className="space-y-4">
            <Card title="Notes" tight>
              <div className="text-xs text-ink-2 leading-relaxed p-2">
                {c.notes ? (
                  <p>{c.notes}</p>
                ) : (
                  <span className="italic text-ink-3">No notes yet. Click "Note" above to add one.</span>
                )}
              </div>
            </Card>

            <Card title="Quick actions" tight>
              <div className="space-y-1 -mx-2">
                {[
                  { icon: "file",     label: "Create quote",     href: "/quotes/new" as string | null },
                  { icon: "mail",     label: "Send email",       href: null },
                  { icon: "whatsapp", label: "WhatsApp",         href: null },
                  { icon: "phone",    label: "Log call",         href: null },
                  { icon: "calendar", label: "Schedule meeting", href: null },
                ].map((a) =>
                  a.href ? (
                    <Link
                      key={a.label}
                      href={a.href as any}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-ink-2 hover:bg-paper-2 transition-colors"
                    >
                      <Icon name={a.icon} size={14} className="text-ink-3" />
                      <span>{a.label}</span>
                    </Link>
                  ) : (
                    <button
                      key={a.label}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-ink-2 hover:bg-paper-2 transition-colors text-left"
                    >
                      <Icon name={a.icon} size={14} className="text-ink-3" />
                      <span>{a.label}</span>
                    </button>
                  )
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* SUBSCRIPTIONS tab */}
      {tab === "subscriptions" && (
        (subs?.length ?? 0) > 0 ? (
          <Card flush>
            <table className="w-full">
              <thead className="bg-paper-2 border-b border-hairline">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Plan</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Vendor</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Seats</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">MRR</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Renewal</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {(subs ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0">
                    <td className="p-3 text-sm font-medium">{s.plan}</td>
                    <td className="p-3 text-sm capitalize">{s.vendor}</td>
                    <td className="p-3 text-right tabular-nums text-sm">{s.seats}</td>
                    <td className="p-3 text-right tabular-nums text-sm">{rupee(s.mrr)}</td>
                    <td className="p-3 text-sm">{s.renewal_date ? formatDate(s.renewal_date) : "—"}</td>
                    <td className="p-3">
                      <Badge kind={s.status === "active" ? "success" : "muted"} dot>{s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState
            icon="refresh"
            title="No subscriptions yet"
            body="Subscriptions appear here once a quote is accepted and provisioned."
            compact
          />
        )
      )}

      {/* QUOTES tab */}
      {tab === "quotes" && (
        (quotes?.length ?? 0) > 0 ? (
          <Card flush>
            <table className="w-full">
              <thead className="bg-paper-2 border-b border-hairline">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Quote ID</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Plan</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Seats</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Amount</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {(quotes ?? []).map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => router.push(`/quotes/${q.id}` as any)}
                    className="border-b border-hairline last:border-0 hover:bg-paper-2/40 cursor-pointer"
                  >
                    <td className="p-3 font-mono text-xs">{q.id}</td>
                    <td className="p-3 text-sm">{q.plan}</td>
                    <td className="p-3 text-right tabular-nums text-sm">{q.seats}</td>
                    <td className="p-3 text-right tabular-nums text-sm font-medium">{rupee(q.amount)}</td>
                    <td className="p-3"><Badge kind="info" dot>{q.status}</Badge></td>
                    <td className="p-3 text-sm">{formatDate(q.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState
            icon="file"
            title="No quotes yet"
            body="Create your first quote for this customer."
            action={
              <Button asChild variant="primary" icon="plus">
                <Link href={"/quotes/new" as any}>New quote</Link>
              </Button>
            }
            compact
          />
        )
      )}

      {/* INVOICES tab */}
      {tab === "invoices" && (
        (invoices?.length ?? 0) > 0 ? (
          <Card flush>
            <table className="w-full">
              <thead className="bg-paper-2 border-b border-hairline">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Date</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Due</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Amount</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {(invoices ?? []).map((i) => (
                  <tr key={i.id} className="border-b border-hairline last:border-0">
                    <td className="p-3 font-mono text-xs">{i.id}</td>
                    <td className="p-3 text-sm">{formatDate(i.invoice_date)}</td>
                    <td className="p-3 text-sm">{i.due_date ? formatDate(i.due_date) : "—"}</td>
                    <td className="p-3 text-right tabular-nums text-sm font-medium">{rupee(i.amount)}</td>
                    <td className="p-3">
                      <Badge kind={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : "warning"} dot>
                        {i.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState
            icon="receipt"
            title="No invoices yet"
            body="Invoices are generated automatically when a quote is accepted + paid."
            compact
          />
        )
      )}

      {/* ACTIVITIES tab */}
      {tab === "activities" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <Card>
            <ActivityTimeline events={buildStubActivity(c.name, c.created_at, c.since)} />
          </Card>
          <div className="space-y-4">
            <Card title="Add activity" tight>
              <div className="space-y-1 -mx-2">
                {[
                  ["phone",    "Log call"],
                  ["mail",     "Send email"],
                  ["whatsapp", "WhatsApp"],
                  ["file",     "Add note"],
                  ["calendar", "Schedule meeting"],
                ].map(([icon, label]) => (
                  <button
                    key={label}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-ink-2 hover:bg-paper-2 transition-colors text-left"
                  >
                    <Icon name={icon} size={14} className="text-ink-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Key contacts" tight>
              {c.contact_name ? (
                <div className="px-2 py-1 flex items-center gap-2.5">
                  <Avatar initials={initials(c.contact_name)} color="indigo" size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{c.contact_name}</div>
                    <div className="text-[10px] text-ink-3">{c.contact_title ?? "—"}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-ink-3 px-2 py-2">No contacts yet.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* FILES tab */}
      {tab === "files" && (
        <EmptyState
          icon="file"
          title="No files yet"
          body="Attach PO documents, signed agreements, migration plans, etc. File upload coming in Phase 2."
          compact
        />
      )}
    </div>
  );
}

// ============================================================
// Stub activity (until activity_log table exists)
// ============================================================
function buildStubActivity(customerName: string, createdAt: string, since: string): TimelineEvent[] {
  return [
    {
      icon: "user", kind: "indigo", title: "Customer added to your workspace",
      body: `${customerName} created in your tenant`,
      time: formatDate(createdAt, "long"),
    },
    {
      icon: "calendar", kind: "amber", title: "Customer since date set",
      body: `Started doing business with you on ${formatDate(since)}`,
      time: formatDate(since),
    },
  ];
}

// ============================================================
// Stat row
// ============================================================
function Stat({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-0.5">{label}</div>
      <div className={cn("text-ink text-sm", mono && "font-mono", !value && "italic text-ink-3")}>
        {value || "—"}
      </div>
    </div>
  );
}

// ============================================================
// KVRow (Health & Revenue card)
// ============================================================
function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline text-sm">
      <span className="text-ink-3 text-xs">{label}</span>
      <span className="tabular-nums font-medium text-ink">{value}</span>
    </div>
  );
}
