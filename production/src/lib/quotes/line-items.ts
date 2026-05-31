/**
 * Quote line-item helpers.
 *
 * addOrMergeLine — the single rule for adding a line to a quote: if the quote
 * already has an ECONOMICALLY-IDENTICAL line (same catalog item + same
 * commitment term + same unit rate, and neither line carries a per-line
 * discount), merge by bumping that line's quantity instead of creating a
 * duplicate row. Two identical rows silently DOUBLE the quote total — a
 * money-correctness / over-quoting bug (audit: duplicate-line in Q-…-0015).
 *
 * Distinct lines are still allowed when something genuinely differs — a
 * different commitment (annual vs monthly), a hand-edited rate, or a per-line
 * discount — because "10 seats annual + 10 seats monthly", or two batches at
 * different prices, are legitimate. Custom items (no item_id) never auto-merge.
 */
import type { QuoteLineItem } from "@/lib/supabase/database.types";

export interface AddOrMergeResult {
  lines: QuoteLineItem[];
  /** true when the candidate merged into an existing line (qty bumped) */
  merged: boolean;
  /** resulting quantity of the merged line (only meaningful when merged) */
  mergedQty?: number;
}

/** Should `candidate` merge into existing line `l`? (economically identical) */
function isSameEconomicLine(l: QuoteLineItem, candidate: QuoteLineItem): boolean {
  return (
    l.item_id != null &&
    candidate.item_id != null &&
    l.item_id === candidate.item_id &&
    (l.commitment ?? null) === (candidate.commitment ?? null) &&
    l.rate === candidate.rate &&
    !l.discount_pct &&
    !candidate.discount_pct
  );
}

/**
 * Return the new line list after adding `line`, merging into an identical
 * existing line when one exists. Pure — does not mutate `lines`.
 */
export function addOrMergeLine(lines: QuoteLineItem[], line: QuoteLineItem): AddOrMergeResult {
  const idx = lines.findIndex((l) => isSameEconomicLine(l, line));
  if (idx >= 0) {
    const next = lines.slice();
    const mergedQty = next[idx].qty + line.qty;
    next[idx] = { ...next[idx], qty: mergedQty };
    return { lines: next, merged: true, mergedQty };
  }
  return { lines: [...lines, line], merged: false };
}
