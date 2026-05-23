/**
 * AddLineItemDialog — pick from catalog OR add a custom line.
 *
 * Two tabs:
 *   1. From catalog (shows items table, click "Add")
 *   2. Custom (free-form name, qty, rate, cost)
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabBar } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon } from "@/components/ui/icon";
import { useItems } from "@/lib/queries/items";
import { rupee } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { QuoteLineItem, Item } from "@/lib/supabase/database.types";

interface AddLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (line: QuoteLineItem) => void;
}

const customSchema = z.object({
  name: z.string().min(2, "Name required"),
  qty: z.coerce.number().int().min(1),
  rate: z.coerce.number().int().min(0),
  cost: z.coerce.number().int().min(0),
});
type CustomData = z.infer<typeof customSchema>;

export function AddLineItemDialog({ open, onOpenChange, onAdd }: AddLineItemDialogProps) {
  const { data: items, isLoading } = useItems();
  const [tab, setTab] = React.useState("catalog");
  const [search, setSearch] = React.useState("");

  const filtered = (items ?? []).filter((it) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return it.name.toLowerCase().includes(s) || it.id.toLowerCase().includes(s);
  });

  // Custom form
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomData>({
    resolver: zodResolver(customSchema),
    defaultValues: { qty: 10, rate: 0, cost: 0 },
  });

  React.useEffect(() => {
    if (!open) {
      reset();
      setSearch("");
      setTab("catalog");
    }
  }, [open, reset]);

  const addFromCatalog = (it: Item) => {
    onAdd({
      id: crypto.randomUUID(),
      item_id: it.id,
      name: it.name,
      qty: 10, // default
      rate: it.msrp,
      cost: it.wholesale,
    });
    onOpenChange(false);
  };

  const addCustom = (data: CustomData) => {
    onAdd({
      id: crypto.randomUUID(),
      name: data.name,
      qty: data.qty,
      rate: data.rate,
      cost: data.cost,
    });
    onOpenChange(false);
  };

  const customRate = watch("rate") || 0;
  const customCost = watch("cost") || 0;
  const customMargin = customRate - customCost;
  const customMarginPct = customRate > 0 ? Math.round((customMargin / customRate) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Add line item</DialogTitle>
          <DialogDescription>
            Pick from your catalog (auto-fills rate + cost), or enter a custom item.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          <TabBar
            value={tab}
            onChange={setTab}
            items={[
              { id: "catalog", label: `From catalog (${items?.length ?? 0})` },
              { id: "custom",  label: "Custom item" },
            ]}
          />
        </div>

        {/* CATALOG tab */}
        {tab === "catalog" && (
          <div>
            <div className="px-6 pt-4 pb-2">
              <Input
                prefix={<Icon name="search" size={14} />}
                placeholder="Search items by name or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto border-t border-hairline">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (items?.length ?? 0) === 0 ? (
                <EmptyState
                  icon="package"
                  title="No items in catalog"
                  body="Add items via /items page first, then come back to build a quote."
                  compact
                />
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-3">
                  No items match "{search}"
                </div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {filtered.map((it) => (
                      <tr
                        key={it.id}
                        className="border-b border-hairline last:border-0 hover:bg-paper-2 transition-colors cursor-pointer"
                        onClick={() => addFromCatalog(it)}
                      >
                        <td className="px-6 py-3">
                          <div className="font-medium text-sm">{it.name}</div>
                          <div className="text-[11px] text-ink-3 font-mono">{it.id}</div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge kind={it.vendor === "google" ? "info" : it.vendor === "microsoft" ? "info" : "success"}>
                            {it.vendor}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-sm">
                          <div className="font-medium">{rupee(it.msrp)}/mo</div>
                          <div className={cn(
                            "text-[10px]",
                            it.margin_pct >= 18 ? "text-emerald" : it.margin_pct >= 14 ? "text-amber-ink" : "text-rose"
                          )}>
                            {it.margin_pct}% margin
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Button size="sm" variant="primary" icon="plus">Add</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-hairline bg-paper-2 text-xs text-ink-3 flex justify-between items-center">
              <span>Tip: rate & cost auto-fill from catalog. Quantity defaults to 10.</span>
              <button
                onClick={() => setTab("custom")}
                className="text-amber-ink underline hover:text-amber font-medium"
              >
                Can't find it? Add custom →
              </button>
            </div>
          </div>
        )}

        {/* CUSTOM tab */}
        {tab === "custom" && (
          <form onSubmit={handleSubmit(addCustom)} className="px-6 pb-6 pt-4 space-y-4">
            <FormField label="Item name" required htmlFor="custom-name">
              <Input
                id="custom-name"
                placeholder="e.g., Custom training package"
                autoFocus
                error={errors.name?.message}
                {...register("name")}
              />
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Quantity" required htmlFor="custom-qty">
                <Input
                  id="custom-qty"
                  type="number"
                  min={1}
                  error={errors.qty?.message}
                  {...register("qty", { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Rate (₹)" required htmlFor="custom-rate">
                <Input
                  id="custom-rate"
                  type="number"
                  min={0}
                  prefix="₹"
                  error={errors.rate?.message}
                  {...register("rate", { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Cost (₹)" required htmlFor="custom-cost">
                <Input
                  id="custom-cost"
                  type="number"
                  min={0}
                  prefix="₹"
                  helper="Your cost"
                  error={errors.cost?.message}
                  {...register("cost", { valueAsNumber: true })}
                />
              </FormField>
            </div>

            {/* Margin preview */}
            {customRate > 0 && (
              <div className={cn(
                "rounded-md p-3 text-sm flex items-center justify-between",
                customMarginPct >= 18 ? "bg-emerald-soft" :
                customMarginPct >= 14 ? "bg-amber-soft" :
                "bg-rose-soft"
              )}>
                <span className="text-ink-2">Margin per unit:</span>
                <span className={cn(
                  "font-serif text-lg tabular-nums",
                  customMarginPct >= 18 ? "text-emerald" :
                  customMarginPct >= 14 ? "text-amber-ink" :
                  "text-rose"
                )}>
                  {rupee(customMargin)} ({customMarginPct}%)
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>Add line</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
