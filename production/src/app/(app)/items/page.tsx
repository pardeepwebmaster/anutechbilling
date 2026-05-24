/**
 * Items Catalog — list with vendor filter + CRUD + load-default-catalog action.
 */
"use client";

import * as React from "react";
import { useItems, useDeleteItem, useLoadDefaultCatalog } from "@/lib/queries/items";
import { ItemForm } from "@/components/features/items/item-form";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { rupee } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Item } from "@/lib/supabase/database.types";

const VENDOR_TABS: TabBarItem[] = [
  { id: "all",       label: "All" },
  { id: "google",    label: "Google",    dot: "indigo" },
  { id: "microsoft", label: "Microsoft", dot: "indigo" },
  { id: "zoho",      label: "Zoho",      dot: "emerald" },
  { id: "other",     label: "Other",     dot: "slate" },
];

const KIND_TABS: TabBarItem[] = [
  { id: "all",   label: "All" },
  { id: "main",  label: "Main plans", dot: "amber" },
  { id: "addon", label: "Add-ons",    dot: "indigo" },
];

export default function ItemsPage() {
  const { data: items, isLoading, error, refetch } = useItems({ includeInactive: true });
  const deleteItem = useDeleteItem();
  const loadDefaults = useLoadDefaultCatalog();

  const [vendor, setVendor] = React.useState("all");
  const [kind,   setKind]   = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Item | null>(null);

  // Filter
  const filtered = (items ?? []).filter((it) => {
    if (vendor !== "all" && it.vendor !== vendor) return false;
    if (kind   !== "all" && it.kind   !== kind)   return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!it.name.toLowerCase().includes(s) && !it.id.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Tab counts
  const counts: Record<string, number> = { all: items?.length ?? 0 };
  for (const it of items ?? []) {
    counts[it.vendor] = (counts[it.vendor] ?? 0) + 1;
  }
  const tabsWithCounts = VENDOR_TABS.map((t) => ({ ...t, count: counts[t.id] ?? 0 }));

  // Kind tab counts
  const kindCounts: Record<string, number> = { all: items?.length ?? 0, main: 0, addon: 0 };
  for (const it of items ?? []) {
    kindCounts[it.kind] = (kindCounts[it.kind] ?? 0) + 1;
  }
  const kindTabsWithCounts = KIND_TABS.map((t) => ({ ...t, count: kindCounts[t.id] ?? 0 }));

  // Aggregates
  const active = (items ?? []).filter((i) => i.is_active);
  const avgMargin =
    active.length > 0
      ? Math.round(active.reduce((s, i) => s + i.margin_pct, 0) / active.length)
      : 0;
  const totalMrr =
    active.length > 0
      ? Math.round(active.reduce((s, i) => s + (i.msrp - i.wholesale), 0) / active.length)
      : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Workspace</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Items Catalog</h1>
          <p className="text-sm text-ink-3 mt-1">
            Products you sell · used in quote line items
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="w-56">
            <Input
              prefix={<Icon name="search" size={14} />}
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setAddOpen(true); }}>
            Add item
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && items && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Total items"     value={items.length}                            trend={`${active.length} active`} />
          <KPI label="Vendors"         value={Object.keys(counts).filter(k => k !== "all").length} trend="catalogs" />
          <KPI label="Avg margin"      value={avgMargin}      unit="%"                  trend={avgMargin >= 18 ? "Healthy" : avgMargin >= 14 ? "OK" : "Squeeze"}
               trendKind={avgMargin >= 18 ? "up" : avgMargin >= 14 ? "neutral" : "down"} icon="rupee" />
          <KPI label="Avg margin (₹/seat)" value={rupee(totalMrr)}                      trend="per item" />
        </div>
      )}

      {/* AI suggestion */}
      {!isLoading && items && items.length > 0 && (
        <GeminiCard title="Catalog intelligence" compact>
          <b>{(items ?? []).filter((i) => i.margin_pct < 14).length} items with margin below 14%.</b>{" "}
          Negotiate better wholesale rates with vendors or consider deprioritizing these products.
        </GeminiCard>
      )}

      {/* Tabs — vendor + kind (main / add-on) */}
      {!isLoading && items && items.length > 0 && (
        <div className="space-y-2">
          <TabBar value={vendor} onChange={setVendor} items={tabsWithCounts} />
          <TabBar value={kind}   onChange={setKind}   items={kindTabsWithCounts} />
        </div>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="alert"
          title="Could not load items"
          body={error.message}
          action={<Button icon="refresh" onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <Card flush>
          <table className="w-full">
            <tbody>
              {[1,2,3,4,5].map((i) => (
                <tr key={i} className="border-b border-hairline">
                  {[1,2,3,4,5].map((j) => (
                    <td key={j} className="p-3"><Skeleton className="h-3 w-full" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Empty — show load-default-catalog CTA */}
      {!isLoading && !error && items && items.length === 0 && (
        <EmptyState
          icon="package"
          title="No items in catalog yet"
          body="Load the default Indian reseller catalog (Google Workspace, Microsoft 365, Zoho) or add your own items manually."
          action={
            <Button
              variant="primary"
              icon="package"
              loading={loadDefaults.isPending}
              onClick={() => loadDefaults.mutate()}
            >
              Load default catalog (7 main + 8 add-ons)
            </Button>
          }
          secondary={
            <Button icon="plus" onClick={() => { setEditing(null); setAddOpen(true); }}>
              Add custom item
            </Button>
          }
        />
      )}

      {/* Filtered empty */}
      {!isLoading && !error && items && items.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon="search"
          title="No items match"
          body={search ? `No results for "${search}".` : `No items in ${vendor}.`}
          action={<Button icon="x" onClick={() => { setVendor("all"); setSearch(""); }}>Clear filters</Button>}
        />
      )}

      {/* Items table */}
      {!isLoading && !error && filtered.length > 0 && (
        <Card flush>
          <table className="w-full">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">ID</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Item</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Type</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Vendor</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">HSN</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">MSRP</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Cost</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Margin</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const margin = it.msrp - it.wholesale;
                const tone: "emerald" | "amber-ink" | "rose" =
                  it.margin_pct >= 18 ? "emerald" : it.margin_pct >= 14 ? "amber-ink" : "rose";
                return (
                  <tr
                    key={it.id}
                    onClick={() => { setEditing(it); setAddOpen(true); }}
                    className={cn(
                      "border-b border-hairline last:border-0 hover:bg-paper-2/40 cursor-pointer transition-colors",
                      !it.is_active && "opacity-50"
                    )}
                  >
                    <td className="p-3 font-mono text-xs">{it.id}</td>
                    <td className="p-3 font-medium text-sm">{it.name}</td>
                    <td className="p-3 text-sm">
                      {it.kind === "main" ? (
                        <Badge kind="warning" dot>Main</Badge>
                      ) : (
                        <Badge kind="info" dot>Add-on</Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm capitalize">
                      <Badge kind={it.vendor === "google" ? "info" : it.vendor === "microsoft" ? "info" : "success"}>
                        {it.vendor}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs text-ink-2">{it.hsn ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums text-sm">{rupee(it.msrp)}</td>
                    <td className="p-3 text-right tabular-nums text-sm text-ink-3">{rupee(it.wholesale)}</td>
                    <td className="p-3 text-right">
                      <div className={cn(
                        "tabular-nums text-sm font-medium",
                        tone === "emerald" && "text-emerald",
                        tone === "amber-ink" && "text-amber-ink",
                        tone === "rose" && "text-rose"
                      )}>
                        {rupee(margin)}
                        <div className="text-[10px]">{it.margin_pct}%</div>
                      </div>
                    </td>
                    <td className="p-3">
                      {it.is_active ? (
                        <Badge kind="success" dot>Active</Badge>
                      ) : (
                        <Badge kind="muted">Inactive</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton icon="more_h" aria-label="More actions" size="sm" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(it); setAddOpen(true); }}>
                            <Icon name="edit" size={14} /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {it.is_active && (
                            <DropdownMenuItem
                              destructive
                              onClick={() => {
                                if (confirm(`Deactivate ${it.name}?`)) {
                                  deleteItem.mutate(it.id);
                                }
                              }}
                            >
                              <Icon name="trash" size={14} /> Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal */}
      <ItemForm open={addOpen} onOpenChange={setAddOpen} item={editing ?? undefined} />
    </div>
  );
}
