/**
 * Customers — list matching prototype design.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomers, useOpenCreditsByCustomer } from "@/lib/queries/customers";
import { useSubscriptions } from "@/lib/queries/subscriptions";
import { useOutstandingReceivables } from "@/lib/queries/payments";
import { FAB } from "@/components/ui/fab";
import { ImportCustomersDialog } from "@/components/features/customers/import-customers-dialog";
import { ImportDomainsDialog } from "@/components/features/customers/import-domains-dialog";
import { CustomerPanel } from "@/components/features/customers/customer-panel";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useResizableColumns, ResizableHandles } from "@/components/ui/resizable-columns";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { rupee, cn } from "@/lib/utils";

// Saved-view segments (Zoho-style) — compact filters over already-loaded data
// (receivables + unused credit + subscriptions). No "health" — that was a static
// placeholder, not a real signal; the list is contact + money oriented now.
type ViewCtx = { amount: number; credit: number; hasSub: boolean };
const VIEW_DEFS: { id: string; label: string; test: (x: ViewCtx) => boolean }[] = [
  { id: "all",        label: "All customers",      test: () => true },
  { id: "unpaid",     label: "Has receivables",    test: (x) => x.amount > 0 },
  { id: "credit",     label: "Has unused credit",  test: (x) => x.credit > 0 },
  { id: "subscribed", label: "With subscriptions", test: (x) => x.hasSub },
  { id: "nosub",      label: "No subscription",    test: (x) => !x.hasSub },
];

// Zoho-Books-style columns: contact + place of supply + receivables + unused credits.
const CUST_COL_ORDER = ["name", "contact", "email", "phone", "state", "receivables", "credits"];
const CUST_COL_DEFAULTS: Record<string, number> = {
  name: 190, contact: 130, email: 210, phone: 140, state: 120, receivables: 130, credits: 130,
};

export default function CustomersPage() {
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const { data: subscriptions } = useSubscriptions();
  const { data: outstanding } = useOutstandingReceivables();
  const { data: creditsByCustomer = {} } = useOpenCreditsByCustomer();

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

  const router = useRouter();
  const goAdd = () => router.push("/customers/new" as never);
  const [search, setSearch] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [domainsOpen, setDomainsOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [view, setView] = React.useState("all");
  const { colW, startResize, totalWidth: custTableW } = useResizableColumns("ros_customers_colw", CUST_COL_DEFAULTS);
  const [visible, setVisible] = React.useState(60);  // render cap — paginates large lists (1000+ rows would hang)

  // Aggregate MRR/ARR per customer from active subscriptions. (No single
  // "renewal" — a customer can have many subs with different dates; renewal is
  // a subscription-level concern, shown on the Customer 360 / Subscriptions.)
  const subsByCustomer = React.useMemo(() => {
    const map = new Map<string, { mrr: number; arr: number }>();
    for (const s of subscriptions ?? []) {
      if (!s.customer_id || s.status !== "active") continue;
      const prev = map.get(s.customer_id) ?? { mrr: 0, arr: 0 };
      map.set(s.customer_id, {
        mrr: prev.mrr + s.mrr,
        arr: prev.arr + s.mrr * 12,
      });
    }
    return map;
  }, [subscriptions]);

  const activeView = VIEW_DEFS.find((v) => v.id === view) ?? VIEW_DEFS[0];

  // Count per saved-view for the dropdown (so each segment shows its size).
  const viewCounts = React.useMemo(() => {
    const m: Record<string, number> = Object.fromEntries(VIEW_DEFS.map((v) => [v.id, 0]));
    for (const c of customers ?? []) {
      const out = outstandingByCustomer.get(c.id);
      const ctx: ViewCtx = { amount: out?.amount ?? 0, credit: creditsByCustomer[c.id] ?? 0, hasSub: subsByCustomer.has(c.id) };
      for (const v of VIEW_DEFS) if (v.test(ctx)) m[v.id]++;
    }
    return m;
  }, [customers, outstandingByCustomer, creditsByCustomer, subsByCustomer]);

  // Filter — saved-view segment first, then the free-text search.
  const filtered = (customers ?? []).filter((c) => {
    const out = outstandingByCustomer.get(c.id);
    const ctx: ViewCtx = { amount: out?.amount ?? 0, credit: creditsByCustomer[c.id] ?? 0, hasSub: subsByCustomer.has(c.id) };
    if (!activeView.test(ctx)) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.display_name?.toLowerCase().includes(s) ?? false) ||
      (c.domain?.toLowerCase().includes(s) ?? false) ||
      (c.contact_name?.toLowerCase().includes(s) ?? false) ||
      (c.contact_email?.toLowerCase().includes(s) ?? false)
    );
  });

  // Only render the first `visible` rows — avoids hanging on 1000+ customers.
  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;
  React.useEffect(() => { setVisible(60); }, [search, view]);

  // KPIs — MRR/ARR (the reseller's core recurring metric) live here in the header
  // so the Zoho-style table below can stay contact + accounting focused.
  const total = customers?.length ?? 0;
  const totalMRR = Array.from(subsByCustomer.values()).reduce((s, x) => s + x.mrr, 0);
  const totalARR = totalMRR * 12;
  const totalReceivables = Array.from(outstandingByCustomer.values()).reduce((s, x) => s + x.amount, 0);

  // Export the current customer list to a CSV (round-trips with the importer:
  // same column names, so an export can be re-imported / shared with the team).
  function handleExport() {
    const rows = customers ?? [];
    if (rows.length === 0) {
      toast.error("No customers to export yet.");
      return;
    }
    const cols = ["name", "contact_name", "contact_email", "contact_phone", "gstin", "state", "domain", "since"] as const;
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(",")];
    for (const c of rows) {
      lines.push(cols.map((k) => esc((c as Record<string, unknown>)[k])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} customer${rows.length === 1 ? "" : "s"} to CSV`);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Workspace</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Customers</h1>
          {!isLoading && customers && (
            <p className="text-sm text-ink-3 mt-1 tabular-nums">
              <b>{total}</b> customer{total === 1 ? "" : "s"}
              {totalMRR > 0 && <> · <b className="text-ink">{rupee(totalMRR, { compact: true })}</b> MRR</>}
              {totalARR > 0 && <> · <b className="text-ink">{rupee(totalARR, { compact: true })}</b> ARR</>}
              {totalReceivables > 0 && <> · <b className="text-rose">{rupee(totalReceivables, { compact: true })}</b> receivables</>}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="download" onClick={handleExport}>Export</Button>
          <Button icon="link" onClick={() => setDomainsOpen(true)}>Link domains</Button>
          <Button icon="upload" onClick={() => setImportOpen(true)}>Import</Button>
          <Button variant="primary" icon="plus" onClick={goAdd}>
            Add customer
          </Button>
        </div>
      </div>

      {/* Compact toolbar — Views dropdown (replaces the space-hungry KPI cards) + search */}
      {!isLoading && customers && customers.length > 0 && !selectedId && (
        <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-hairline bg-paper text-sm font-medium hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
                <Icon name="filter" size={13} className="text-ink-3" />
                {activeView.label}
                <span className="text-ink-3 tabular-nums">{viewCounts[activeView.id]}</span>
                <Icon name="chevron_down" size={14} className="text-ink-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Views</DropdownMenuLabel>
                {VIEW_DEFS.map((v) => (
                  <DropdownMenuItem key={v.id} onClick={() => setView(v.id)}>
                    <Icon name={view === v.id ? "check" : "filter"} size={14} className={view === v.id ? "text-amber" : "text-ink-3"} />
                    <span className="flex-1">{v.label}</span>
                    <span className="text-ink-3 tabular-nums text-xs">{viewCounts[v.id]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-xs text-ink-3 tabular-nums">Showing {filtered.length} of {total}</span>
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
          action={<Button variant="primary" icon="plus" onClick={goAdd}>Add your first customer</Button>}
          secondary={<Button icon="download" onClick={() => setImportOpen(true)}>Import CSV</Button>}
        />
      )}

      {/* Mobile card list — phones only */}
      {!isLoading && !error && filtered.length > 0 && (
        <ul className="md:hidden space-y-2 mb-3">
          {shown.map((c) => {
            const receivable = outstandingByCustomer.get(c.id)?.amount ?? 0;
            const credit = creditsByCustomer[c.id] ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}` as never}
                  className="block bg-paper border border-hairline rounded-lg p-3 active:bg-paper-2/50"
                >
                  <div className="min-w-0 mb-2">
                    <p className="font-medium text-amber-ink truncate">{c.display_name || c.name}</p>
                    <p className="text-[11px] text-ink-3 truncate mt-0.5">
                      {c.contact_name && <>{c.contact_name} · </>}
                      {c.contact_email || c.domain || (c.state ? c.state : "—")}
                    </p>
                    {c.contact_phone && (
                      <p className="text-[11px] text-ink-3 font-mono truncate mt-0.5">{c.contact_phone}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/60 text-xs">
                    <span className="text-ink-3">
                      Receivables <b className={receivable > 0 ? "text-rose" : "text-ink-2"}>{rupee(receivable)}</b>
                    </span>
                    <span className="text-ink-3">
                      Credits <b className={credit > 0 ? "text-emerald" : "text-ink-2"}>{rupee(credit)}</b>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
          {hasMore && (
            <li className="pt-1 text-center">
              <Button variant="default" size="sm" onClick={() => setVisible((v) => v + 100)}>
                Show more ({filtered.length - shown.length} left)
              </Button>
            </li>
          )}
        </ul>
      )}

      {/* Desktop table — full-width mode (no customer selected) */}
      {!isLoading && !error && filtered.length > 0 && !selectedId && (
        <div className="hidden md:block">
          <Card flush className="overflow-x-auto">
            <div className="relative" style={{ width: custTableW }}>
            <table className="w-full table-fixed">
              <colgroup>
                {CUST_COL_ORDER.map((id) => <col key={id} style={{ width: colW[id] }} />)}
              </colgroup>
              <thead className="bg-paper-2 border-b border-hairline">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Name</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Contact</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Email</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Work phone</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Place of supply</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Receivables</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Unused credits</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const receivable = outstandingByCustomer.get(c.id)?.amount ?? 0;
                  const credit = creditsByCustomer[c.id] ?? 0;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "border-b border-hairline last:border-0 cursor-pointer transition-colors",
                        receivable > 0 ? "hover:bg-rose-soft/20" : "hover:bg-paper-2/40",
                      )}
                    >
                      <td className={cn("p-3", receivable > 0 && "border-l-2 border-l-rose")}>
                        <div className="font-medium text-sm text-amber-ink truncate">{c.display_name || c.name}</div>
                        {c.domain && (
                          <div className="text-[11px] text-ink-3 font-mono truncate mt-0.5">{c.domain}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-ink-2 truncate">{c.contact_name || <span className="text-ink-3">—</span>}</td>
                      <td className="p-3 text-xs font-mono text-ink-2 truncate" title={c.contact_email ?? undefined}>{c.contact_email || <span className="text-ink-3">—</span>}</td>
                      <td className="p-3 text-xs font-mono text-ink-2 truncate">{c.contact_phone || <span className="text-ink-3">—</span>}</td>
                      <td className="p-3 text-sm text-ink-2 truncate">{c.state || <span className="text-ink-3">—</span>}</td>
                      <td className="p-3 text-right tabular-nums">
                        <span className={receivable > 0 ? "text-sm font-medium text-rose" : "text-sm text-ink-3"}>{rupee(receivable)}</span>
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        <span className={credit > 0 ? "text-sm font-medium text-emerald" : "text-sm text-ink-3"}>{rupee(credit)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ResizableHandles colW={colW} order={CUST_COL_ORDER} startResize={startResize} />
            </div>
          </Card>

          {/* Help text */}
          <div className="flex items-center gap-1.5 text-xs text-ink-3 mt-3">
            <Icon name="info" size={11} />
            Click any row to open the Customer 360 view with full activity timeline, subscriptions, and contacts.
          </div>
          {hasMore && (
            <div className="flex justify-center py-3">
              <Button variant="default" size="sm" onClick={() => setVisible((v) => v + 100)}>
                Show more ({filtered.length - shown.length} left)
              </Button>
            </div>
          )}
        </div>
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
      {/* Master-detail mode — a customer is selected (desktop). Mobile keeps
          the full list + navigates to the full 360 page. */}
      {!isLoading && !error && selectedId && (
        <div className="hidden md:flex border border-hairline rounded-xl overflow-hidden bg-paper h-[calc(100vh-200px)] min-h-[480px]">
          <div className="w-[300px] border-r border-hairline flex flex-col min-h-0">
            <div className="p-2 border-b border-hairline">
              <Input
                prefix={<Icon name="search" size={14} />}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {shown.map((c) => {
                const sub = subsByCustomer.get(c.id);
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-hairline/60 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-inset",
                      active ? "bg-amber-soft/50" : "hover:bg-paper-2/50",
                    )}
                  >
                    <div className="font-medium text-sm text-ink truncate">{c.display_name || c.name}</div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-ink-3 mt-0.5">
                      <span className="truncate">{c.domain || c.contact_email || "—"}</span>
                      {sub ? <span className="tabular-nums flex-shrink-0">{rupee(sub.mrr)}</span> : null}
                    </div>
                  </button>
                );
              })}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + 100)}
                  className="w-full text-center py-2 text-xs text-amber-ink hover:bg-paper-2/50"
                >
                  Show more ({filtered.length - shown.length} left)
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <CustomerPanel customerId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}

      <ImportCustomersDialog open={importOpen} onOpenChange={setImportOpen} onImportComplete={() => refetch()} />
      <ImportDomainsDialog open={domainsOpen} onOpenChange={setDomainsOpen} onComplete={() => refetch()} />

      {/* Mobile thumb-zone add — desktop uses the header button. */}
      <FAB icon="plus" label="Add customer" onClick={goAdd} />
    </div>
  );
}
