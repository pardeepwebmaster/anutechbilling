"use client";

/**
 * StatStrip — a compact, single-row replacement for big KPI-card grids.
 *
 * The large KPI cards (≈120px tall) ate vertical space and pushed the actual
 * list far down the page. This renders the same metrics as a thin inline strip
 * (≈32px), wrapping gracefully on narrow screens. Used by list pages that
 * already have a tab/views filter (Quotes, Invoices) so the header stays tight.
 */
import { cn } from "@/lib/utils";

export type Stat = {
  label: string;
  value: string | number;
  tone?: "default" | "rose" | "emerald" | "amber";
};

export function StatStrip({ items, className }: { items: Stat[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-6 gap-y-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">{it.label}</span>
          <span
            className={cn(
              "text-base font-semibold tabular-nums",
              it.tone === "rose" ? "text-rose"
                : it.tone === "emerald" ? "text-emerald"
                : it.tone === "amber" ? "text-amber-ink"
                : "text-ink",
            )}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
