/**
 * Quotes — list matching prototype design.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuotes, useDeleteQuote } from "@/lib/queries/quotes";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { KPI } from "@/components/shared/kpi";
import { computeMargin } from "@/components/features/margin-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, IconButton } from "@/components/ui/button";
import { QuotePreviewDialog } from "@/components/features/quotes/quote-preview-dialog";
import type { QuoteLineItem } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate, daysBetween } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/supabase/database.types";

// Heuristic margin estimate per quote (until we have line items always populated)
function estimateMarginForQuote(q: Quote) {
  if (q.subtotal && q.total_cost) {
    const taxable = q.subtotal - Math.round(q.subtotal * (q.discount_pct / 100));
    return computeMargin(q.total_cost, taxable);
  }
  if (!q.amount || !q.seats) return computeMargin(0, 0);
  const cost = Math.round(q.amount * 0.83);
  return computeMargin(cost, q.amount);
}

const STATUS_META: Record<Quote["status"], { kind: "muted" | "success" | "warning" | "danger" | "info"; label: string }> = {
  draft:    { kind: "muted",   label: "Draft" },
  sent:     { kind: "warning", label: "Sent" },
  viewed:   { kind: "info",    label: "Viewed" },
  accepted: { kind: "success", label: "Accepted" },
  rejected: { kind: "danger",  label: "Rejected" },
  expired:  { kind: "danger",  label: "Expired" },
};

/**
 * Compact payment indicator shown under the amount.
 * 'none' is treated as "nothing to say" — most drafts/sent quotes are pre-payment
 * and shouldn't clutter the view. We surface every other state so an accepted-
 * but-unpaid quote stands out clearly.
 */
type Tone = "emerald" | "amber" | "rose";
function PaymentLabel({ ps, paid }: { ps: Quote["payment_status"] | null; paid: number | null }) {
  if (!ps || ps === "none") return null;

  const map: Record<Exclude<Quote["payment_status"], "none">, { tone: Tone; label: string }> = {
    awaiting: { tone: "amber",   label: "Awaiting" },
    partial:  { tone: "amber",   label: paid ? `Partial · ${rupee(paid)}` : "Partial" },
    received: { tone: "emerald", label: "Paid" },
    invoiced: { tone: "emerald", label: "Invoiced" },
  };
  const m = map[ps];
  if (!m) return null;

  const toneClass =
    m.tone === "emerald" ? "text-emerald" :
    m.tone === "amber"   ? "text-amber-ink" :
                           "text-rose";

  return (
    <span className={cn("text-[10px] font-medium tabular-nums leading-tight", toneClass)}>
      ● {m.label}
    </span>
  );
}

export default function QuotesPage() {
  const router = useRouter();
  const { data: quotes, isLoading, error, refetch } = useQuotes();
  const { data: currentUser } = useCurrentUser();
  const deleteQuote = useDeleteQuote();
  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [previewing, setPreviewing] = React.useState<Quote | null>(null);

  const handleDelete = (q: Quote) => {
    const warn = q.status === "accepted" || q.payment_status === "received" || q.payment_status === "invoiced"
      ? "\n\n⚠️ This quote is ACCEPTED/PAID — deleting may break audit trail."
      : "";
    if (window.confirm(`Permanently delete quote ${q.id}?${warn}\n\nThis cannot be undone.`)) {
      deleteQuote.mutate(q.id);
    }
  };

  const handleDuplicate = (q: Quote) => {
    const params = new URLSearchParams();
    params.set("duplicate", q.id);
    if (q.lead_id)       params.set("leadId",  q.lead_id);
    if (q.customer_name) params.set("company", q.customer_name);
    router.push(`/quotes/new?${params.toString()}` as any);
  };

  // Counts per status — adds an "invoiced" bucket on top of the quote.status
  // enum, derived from payment_status. Truly-done deals (accepted + paid +
  // GST invoice issued) get their own tab; the Accepted tab then surfaces
  // only the still-in-flight ones (accepted but money flow incomplete).
  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: quotes?.length ?? 0, invoiced: 0 };
    for (const q of quotes ?? []) {
      if (q.payment_status === "invoiced") {
        map.invoiced += 1;
        // also count under the underlying status (usually 'accepted') for
        // tracking, but the Accepted tab excludes invoiced ones below
        map[q.status] = (map[q.status] ?? 0) + 1;
      } else {
        map[q.status] = (map[q.status] ?? 0) + 1;
      }
    }
    return map;
  }, [quotes]);

  // Accepted-but-not-yet-invoiced count for the tab badge
  const acceptedActive = (counts.accepted ?? 0) - (counts.invoiced ?? 0);

  const tabs: TabBarItem[] = [
    { id: "all",      label: "All",      count: counts.all ?? 0 },
    { id: "draft",    label: "Draft",    count: counts.draft ?? 0, dot: "slate" },
    { id: "sent",     label: "Sent",     count: counts.sent ?? 0, dot: "amber" },
    { id: "viewed",   label: "Viewed",   count: counts.viewed ?? 0, dot: "indigo" },
    { id: "accepted", label: "Accepted", count: acceptedActive,        dot: "emerald" },
    { id: "invoiced", label: "Invoiced", count: counts.invoiced ?? 0,  dot: "emerald" },
    { id: "expired",  label: "Expired",  count: (counts.expired ?? 0) + (counts.rejected ?? 0), dot: "rose" },
  ];

  // Filter
  const filtered = (quotes ?? []).filter((q) => {
    if (tab === "expired") {
      if (q.status !== "expired" && q.status !== "rejected") return false;
    } else if (tab === "invoiced") {
      // Invoiced bucket is defined by payment_status, not quote.status
      if (q.payment_status !== "invoiced") return false;
    } else if (tab === "accepted") {
      // Accepted tab excludes those that have already graduated to invoiced
      if (q.status !== "accepted" || q.payment_status === "invoiced") return false;
    } else if (tab !== "all" && q.status !== tab) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      q.id.toLowerCase().includes(s) ||
      q.customer_name.toLowerCase().includes(s) ||
      (q.plan?.toLowerCase().includes(s) ?? false)
    );
  });

  // KPIs
  const totalValue = (quotes ?? []).reduce((s, q) => s + (q.amount ?? 0), 0);
  const acceptedValue = (quotes ?? [])
    .filter((q) => q.status === "accepted")
    .reduce((s, q) => s + (q.amount ?? 0), 0);
  const sentValue = (quotes ?? [])
    .filter((q) => q.status === "sent" || q.status === "viewed")
    .reduce((s, q) => s + (q.amount ?? 0), 0);
  const pipelineMargin = (quotes ?? [])
    .filter((q) => q.status === "sent" || q.status === "viewed")
    .reduce((s, q) => s + estimateMarginForQuote(q).margin, 0);
  const acceptedCount = counts.accepted ?? 0;
  const sentishCount = (counts.sent ?? 0) + (counts.viewed ?? 0);
  const winRate = (quotes ?? []).length > 0
    ? Math.round((acceptedCount / Math.max(1, (quotes?.length ?? 1) - (counts.draft ?? 0))) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Revenue</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Quotes</h1>
          <p className="text-sm text-ink-3 mt-1">All generated quotes · sorted by most recent</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="download">Export</Button>
          <Button asChild variant="primary" icon="plus">
            <Link href={"/quotes/new" as any}>New Quote</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && quotes && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <KPI label="Total quotes"    value={quotes.length} trend="this quarter" />
          <KPI label="Pipeline value"  value={rupee(totalValue, { compact: true })} trend={`${sentishCount} in motion`} trendKind="up" trendIcon="trending_up" />
          <KPI label="Out for review"  value={rupee(sentValue, { compact: true })} trend={`${sentishCount} sent/viewed`} />
          <KPI label="Pipeline Margin" value={rupee(pipelineMargin, { compact: true })} trend="Your edge" trendKind="up" icon="rupee" />
          <KPI label="Accepted"        value={rupee(acceptedValue, { compact: true })} trend={`${acceptedCount} won`} trendKind="up" trendIcon="check" />
          <KPI label="Win rate"        value={winRate} unit="%" trend="excl. drafts" trendKind="up" trendIcon="trending_up" />
        </div>
      )}

      {/* AI suggestion */}
      {!isLoading && quotes && quotes.length > 0 && sentishCount > 0 && (
        <div className="mb-4">
          <GeminiCard
            title="Quote intelligence"
            actions={
              <Button size="sm" variant="primary" icon="mail">
                Nudge expiring quotes
              </Button>
            }
            compact
          >
            <b>{sentishCount} quotes out for review.</b>{" "}
            Expiring within 7 days are highest priority — send a nudge to those customers.
          </GeminiCard>
        </div>
      )}

      {/* Tabs + filter */}
      {!isLoading && quotes && quotes.length > 0 && (
        <>
          <div className="mb-3">
            <TabBar value={tab} onChange={setTab} items={tabs} />
          </div>
          <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
            <div className="text-xs text-ink-3">
              Showing {filtered.length} of {counts.all ?? 0} quotes
            </div>
            <div className="w-64">
              <Input
                prefix={<Icon name="search" size={14} />}
                placeholder="Quote ID, customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="alert"
          title="Could not load quotes"
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
      {!isLoading && !error && quotes && quotes.length === 0 && (
        <EmptyState
          icon="file"
          title="No quotes yet"
          body="Quotes will appear here once you create your first quote for a customer."
          action={
            <Button asChild variant="primary" icon="plus">
              <Link href={"/quotes/new" as any}>Create your first quote</Link>
            </Button>
          }
        />
      )}

      {/* Filtered empty */}
      {!isLoading && !error && quotes && quotes.length > 0 && filtered.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="search"
            title="No quotes match"
            body={search ? `No results for "${search}".` : `No quotes in "${tab}" status.`}
            action={<Button icon="x" onClick={() => { setTab("all"); setSearch(""); }}>Clear filters</Button>}
            compact
          />
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && filtered.length > 0 && (
        <>
          <Card flush>
            <table className="w-full">
              <thead className="bg-paper-2 border-b border-hairline">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Quote ID</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Customer</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Plan</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Seats</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Amount</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider" title="Annual margin">Margin</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Created</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Validity</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Owner</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => {
                  const margin = estimateMarginForQuote(q);
                  const meta = STATUS_META[q.status];
                  const dl = q.expires_date ? daysBetween(new Date(), q.expires_date) : null;
                  const expiringSoon = dl !== null && dl >= 0 && dl <= 7;
                  return (
                    <tr
                      key={q.id}
                      onClick={() => router.push(`/quotes/${q.id}` as any)}
                      className="border-b border-hairline last:border-0 hover:bg-paper-2/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono text-xs font-semibold text-ink">
                        <div className="flex items-center gap-1.5">
                          <span>{q.id}</span>
                          {q.is_renewal && (
                            <Badge kind="info" className="font-sans text-[10px]">
                              Renewal
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-ink">{q.customer_name}</div>
                        {q.lead_id && (
                          <div className="text-[10px] text-ink-3 font-mono">from {q.lead_id}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-ink-2">{q.plan ?? "—"}</td>
                      <td className="p-3 text-right tabular-nums text-sm">{q.seats ?? "—"}</td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="tabular-nums text-sm font-medium">
                            {q.amount ? rupee(q.amount) : "—"}
                          </span>
                          <PaymentLabel ps={q.payment_status} paid={q.payment_amount} />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {q.amount ? (
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "tabular-nums text-sm font-medium",
                              margin.marginPct >= 18 ? "text-emerald" :
                              margin.marginPct >= 14 ? "text-amber-ink" :
                              "text-rose"
                            )}>
                              {rupee(margin.margin)}
                            </span>
                            <span className="text-[10px] text-ink-3 tabular-nums">{margin.marginPct}%</span>
                          </div>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge kind={meta.kind} dot>{meta.label}</Badge>
                      </td>
                      <td className="p-3 text-sm text-ink-2">{formatDate(q.created_date)}</td>
                      <td className="p-3 text-sm">
                        {q.status === "accepted" || q.status === "rejected" ? (
                          <span className="text-ink-3">—</span>
                        ) : dl === null ? (
                          <span className="text-ink-3">—</span>
                        ) : dl < 0 ? (
                          <Badge kind="danger" dot>Expired {Math.abs(dl)}d</Badge>
                        ) : expiringSoon ? (
                          <Badge kind="warning" dot>{dl}d left</Badge>
                        ) : (
                          <span className="text-xs text-ink-3 tabular-nums">{dl}d left</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar initials="PA" color="amber" size="sm" />
                          <span className="text-xs">Pardeep</span>
                        </div>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton
                            icon="file"
                            size="sm"
                            variant="ghost"
                            aria-label="Preview quote"
                            title="Preview quote"
                            onClick={() => setPreviewing(q)}
                          />
                          {q.status === "draft" && (
                            <Button asChild size="sm" variant="primary" icon="send">
                              <Link href={`/quotes/${q.id}` as any}>Send</Link>
                            </Button>
                          )}
                          {(q.status === "sent" || q.status === "viewed") && (
                            <Button asChild size="sm" icon="external">
                              <Link href={`/quotes/${q.id}` as any}>Open</Link>
                            </Button>
                          )}
                          {q.status === "accepted" && (() => {
                            // What happens NEXT on an accepted quote depends on
                            // how far the money flow has progressed. The button
                            // tells the operator exactly which step is pending.
                            const ps = q.payment_status;
                            if (ps === "invoiced") {
                              // Terminal — money flow complete, jump to the
                              // actual invoice (auto-opens that dialog via
                              // ?open=INV-XX deep link on /invoices)
                              return (
                                <Button asChild size="sm" icon="receipt">
                                  <Link
                                    href={
                                      q.invoice_id
                                        ? (`/invoices?open=${q.invoice_id}` as any)
                                        : (`/quotes/${q.id}` as any)
                                    }
                                  >
                                    Invoiced
                                  </Link>
                                </Button>
                              );
                            }
                            if (ps === "received") {
                              return (
                                <Button asChild size="sm" variant="primary" icon="receipt">
                                  <Link href={`/quotes/${q.id}` as any}>Generate invoice</Link>
                                </Button>
                              );
                            }
                            if (ps === "partial") {
                              return (
                                <Button asChild size="sm" icon="rupee">
                                  <Link href={`/quotes/${q.id}` as any}>Continue billing</Link>
                                </Button>
                              );
                            }
                            // 'none' or 'awaiting' — money hasn't started flowing yet
                            return (
                              <Button asChild size="sm" variant="primary" icon="rupee">
                                <Link href={`/quotes/${q.id}` as any}>Record payment</Link>
                              </Button>
                            );
                          })()}
                          {(q.status === "expired" || q.status === "rejected") && (
                            <Button asChild size="sm" icon="copy">
                              <Link href={`/quotes/new` as any}>Re-quote</Link>
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <IconButton
                                icon="more_h"
                                size="sm"
                                variant="ghost"
                                aria-label="More actions"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/quotes/${q.id}` as any)}
                              >
                                <Icon name="edit" size={14} /> Edit / View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(q)}>
                                <Icon name="copy" size={14} /> Duplicate & revise
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPreviewing(q)}>
                                <Icon name="file" size={14} /> Preview
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={() => handleDelete(q)}
                              >
                                <Icon name="trash" size={14} /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
            Click any row to open the quote. Hit the file icon for a quick PDF preview.
          </div>
        </>
      )}

      {/* Quick preview dialog (driven by the row's eye/file icon button) */}
      {previewing && (() => {
        const q = previewing;
        const items: QuoteLineItem[] = Array.isArray(q.line_items) ? (q.line_items as QuoteLineItem[]) : [];
        const discount = Math.round(q.subtotal * (q.discount_pct / 100));
        const taxable  = q.subtotal - discount;
        const tax      = Math.round(taxable * (q.tax_rate / 100));
        const total    = q.amount ?? taxable + tax;
        const validity = q.expires_date
          ? Math.max(1, daysBetween(new Date(q.created_at), q.expires_date))
          : 30;

        return (
          <QuotePreviewDialog
            open={!!previewing}
            onOpenChange={(o) => !o && setPreviewing(null)}
            tenantName={currentUser?.tenantName    ?? "Workspace"}
            tenantGstin={currentUser?.tenantGstin}
            tenantEmail={currentUser?.tenantEmail}
            tenantPhone={currentUser?.tenantPhone}
            tenantAddress={currentUser?.tenantAddress}
            quoteId={q.id}
            customerName={q.customer_name}
            contactName={null}
            contactEmail={null}
            contactPhone={null}
            lineItems={items}
            subtotal={q.subtotal}
            discountPct={q.discount_pct}
            discount={discount}
            taxable={taxable}
            taxRate={q.tax_rate}
            tax={tax}
            total={total}
            interState={false}
            validityDays={validity}
            notes={q.notes ?? ""}
            isProspect={!!q.lead_id}
          />
        );
      })()}
    </div>
  );
}
