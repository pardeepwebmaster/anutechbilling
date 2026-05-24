/**
 * useNavBadges — fetches live counts for sidebar badges.
 *
 * Returns a map of nav item id → badge string (or undefined if zero).
 * Only shows a badge when count > 0 so the sidebar stays clean.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface NavBadges {
  leads?:        string;
  tasks?:        string;
  renewals?:     string;
  invoices?:     string;
  payments?:     string;
  support?:      string;
  whatsapp?:     string;
}

async function fetchNavBadges(): Promise<NavBadges> {
  const supabase = createClient();
  const badges: NavBadges = {};

  // End-of-today in IST as UTC ISO — used for "due today or overdue" count.
  // (Replicated from lib/queries/tasks.ts todayBoundariesIST so this hook
  // doesn't depend on the queries module.)
  const now = new Date();
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const istMid = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  const startUTC = new Date(istMid.getTime() - (5.5 * 60 * 60 * 1000));
  const endOfTodayISO = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // Run all counts in parallel
  const [leadsRes, tasksRes, renewalsRes, invoicesRes, paymentsRes] = await Promise.all([
    // Active leads (not won/lost)
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("stage", "in", '("won","lost")'),

    // Pending tasks due by end of today (overdue + today combined — the
    // ones the rep needs to clear before EOD)
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("due_at", endOfTodayISO),

    // Renewals due in next 30 days
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("renewal_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),

    // Unpaid / overdue invoices
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "overdue"]),

    // Payments received but invoice NOT yet generated (operator action needed)
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "received"),
  ]);

  const leadsCount    = leadsRes.count    ?? 0;
  const tasksCount    = tasksRes.count    ?? 0;
  const renewalsCount = renewalsRes.count ?? 0;
  const invoicesCount = invoicesRes.count ?? 0;
  const paymentsCount = paymentsRes.count ?? 0;

  if (leadsCount    > 0) badges.leads    = String(leadsCount);
  if (tasksCount    > 0) badges.tasks    = String(tasksCount);
  if (renewalsCount > 0) badges.renewals = String(renewalsCount);
  if (invoicesCount > 0) badges.invoices = String(invoicesCount);
  if (paymentsCount > 0) badges.payments = String(paymentsCount);

  return badges;
}

export function useNavBadges(): NavBadges {
  const { data } = useQuery({
    queryKey: ["nav-badges"],
    queryFn:  fetchNavBadges,
    refetchInterval: 60_000,   // refresh every 60 seconds
    staleTime:       30_000,
  });
  return data ?? {};
}
