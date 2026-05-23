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
  renewals?:     string;
  invoices?:     string;
  payments?:     string;
  support?:      string;
  whatsapp?:     string;
}

async function fetchNavBadges(): Promise<NavBadges> {
  const supabase = createClient();
  const badges: NavBadges = {};

  // Run all counts in parallel
  const [leadsRes, renewalsRes, invoicesRes, paymentsRes] = await Promise.all([
    // Active leads (not won/lost)
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("stage", "in", '("won","lost")'),

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
  const renewalsCount = renewalsRes.count ?? 0;
  const invoicesCount = invoicesRes.count ?? 0;
  const paymentsCount = paymentsRes.count ?? 0;

  if (leadsCount    > 0) badges.leads    = String(leadsCount);
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
