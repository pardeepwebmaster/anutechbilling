/**
 * Contacts — aggregated view of every person known to the tenant (leads + customers).
 * Pure derivation from existing tables; no new DB schema yet.
 *
 * Down the line we can promote this to a real `contacts` table when we need
 * standalone contacts (newsletter subscribers, networking, etc.) or richer
 * features like tags, opt-out, lifecycle stage.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ContactSource = "lead" | "customer";

export interface UnifiedContact {
  id:        string;            // "lead:<id>" or "customer:<id>"
  source:    ContactSource;
  refId:     string;            // original lead.id or customer.id
  name:      string | null;
  email:     string | null;
  phone:     string | null;
  company:   string;
  title:     string | null;
  /** For leads: stage. For customers: health (0-100). */
  status:    string | null;
  createdAt: string;
}

export function useAllContacts() {
  return useQuery({
    queryKey: ["contacts", "all"],
    queryFn: async (): Promise<UnifiedContact[]> => {
      const supabase = createClient();

      const [leadsRes, customersRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, company, contact_name, contact_email, contact_phone, stage, created_at"),
        supabase
          .from("customers")
          .select("id, name, contact_name, contact_title, contact_email, contact_phone, health, created_at"),
      ]);

      if (leadsRes.error)     throw leadsRes.error;
      if (customersRes.error) throw customersRes.error;

      const fromLeads: UnifiedContact[] = (leadsRes.data ?? [])
        .filter((l) => l.contact_name || l.contact_email || l.contact_phone)
        .map((l) => ({
          id:        `lead:${l.id}`,
          source:    "lead" as const,
          refId:     l.id,
          name:      l.contact_name,
          email:     l.contact_email,
          phone:     l.contact_phone,
          company:   l.company,
          title:     null,
          status:    l.stage,
          createdAt: l.created_at,
        }));

      const fromCustomers: UnifiedContact[] = (customersRes.data ?? [])
        .filter((c) => c.contact_name || c.contact_email || c.contact_phone)
        .map((c) => ({
          id:        `customer:${c.id}`,
          source:    "customer" as const,
          refId:     c.id,
          name:      c.contact_name,
          email:     c.contact_email,
          phone:     c.contact_phone,
          company:   c.name,
          title:     c.contact_title,
          status:    c.health != null ? String(c.health) : null,
          createdAt: c.created_at,
        }));

      // Combine + dedupe by email (a customer + lead with same email = 1 contact, prefer customer)
      const seenEmails = new Set<string>();
      const combined: UnifiedContact[] = [];

      for (const c of fromCustomers) {
        const key = c.email?.toLowerCase().trim();
        if (key) seenEmails.add(key);
        combined.push(c);
      }
      for (const l of fromLeads) {
        const key = l.email?.toLowerCase().trim();
        if (key && seenEmails.has(key)) continue;
        if (key) seenEmails.add(key);
        combined.push(l);
      }

      // Sort by created date desc
      combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return combined;
    },
  });
}
