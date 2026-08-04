/**
 * Payments Made — the purchase-side mirror of the Sales "Payments" list.
 *
 * Recording a vendor payment already happens per-bill (Vendor Bills → Record
 * payment → pay_vendor_bill), which posts a bank_transaction debit tagged
 * matched_to_type='vendor_bill'. This hook reads those back as a consolidated
 * "money paid to vendors" feed. Read-only — no new money-write.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface BillPayment {
  id:                string;
  txn_date:          string;
  vendor_name:       string;
  bill_id:           string | null;
  bill_no:           string | null;
  amount:            number;          // ₹ paid (the bank debit)
  method:            string | null;
  bank_account_id:   string;
  bank_account_name: string;
}

export function useBillPayments() {
  return useQuery({
    queryKey: ["bill-payments"],
    queryFn: async (): Promise<BillPayment[]> => {
      const supabase = createClient();

      const { data: txns, error } = await supabase
        .from("bank_transactions")
        .select("id, txn_date, description, debit, reference, bank_account_id, matched_to_id")
        .eq("matched_to_type", "vendor_bill")
        .order("txn_date", { ascending: false });
      if (error) throw error;
      const rows = txns ?? [];
      if (rows.length === 0) return [];

      const acctIds = [...new Set(rows.map((r) => r.bank_account_id).filter(Boolean))] as string[];
      const billIds = [...new Set(rows.map((r) => r.matched_to_id).filter(Boolean))] as string[];

      const [{ data: accts }, { data: bills }] = await Promise.all([
        acctIds.length
          ? supabase.from("bank_accounts").select("id, name").in("id", acctIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        billIds.length
          ? supabase.from("vendor_bills").select("id, bill_no, vendor_name").in("id", billIds)
          : Promise.resolve({ data: [] as { id: string; bill_no: string | null; vendor_name: string }[] }),
      ]);

      const acctMap = new Map((accts ?? []).map((a) => [a.id, a.name]));
      const billMap = new Map((bills ?? []).map((b) => [b.id, b]));

      return rows.map((r) => {
        const bill = r.matched_to_id ? billMap.get(r.matched_to_id) : undefined;
        return {
          id:                r.id,
          txn_date:          r.txn_date,
          vendor_name:       bill?.vendor_name ?? ((r.description ?? "").replace(/^Bill payment:\s*/i, "").trim() || "Vendor"),
          bill_id:           r.matched_to_id ?? null,
          bill_no:           bill?.bill_no ?? null,
          amount:            r.debit ?? 0,
          method:            r.reference ?? null,
          bank_account_id:   r.bank_account_id,
          bank_account_name: acctMap.get(r.bank_account_id) ?? "—",
        };
      });
    },
  });
}
