/**
 * Lead "heat" — the single source of truth for what makes a lead high-value or
 * hot. Shared by the Leads list (row tags + rails), the smart-view chips, and
 * the view filters so the count on a chip ALWAYS matches the tagged rows.
 * (Before this, the Hot chip counted stage while the row tag used priority —
 * so the inbox could show "Hot 0" with Hot-tagged rows. This file fixes that.)
 */
import type { Lead } from "@/lib/supabase/database.types";

/** A lead worth ≥ ₹1 lakh gets the emerald high-value treatment. */
export const HIGH_VALUE = 100_000;

export function isHighValueLead(l: Pick<Lead, "value">): boolean {
  return (l.value ?? 0) >= HIGH_VALUE;
}

/**
 * "Hot" = worth prioritising today. Two signals, unified so every surface
 * agrees:
 *   • priority = high  — the operator explicitly flagged it urgent, OR
 *   • stage in demo / trial / quote — advanced in the funnel, closest to a win.
 */
export function isHotLead(l: Pick<Lead, "priority" | "stage">): boolean {
  return (
    l.priority === "high" ||
    l.stage === "demo" ||
    l.stage === "trial" ||
    l.stage === "quote"
  );
}

/** Human reason a lead is hot — powers the "Hot" tag tooltip so it's never a
 *  mystery. Priority takes precedence when both signals are true. "" if not hot. */
export function hotReason(l: Pick<Lead, "priority" | "stage">): string {
  if (l.priority === "high") return "High priority";
  if (l.stage === "quote") return "Quote sent";
  if (l.stage === "trial") return "Trial active";
  if (l.stage === "demo") return "Demo done";
  return "";
}
