/**
 * /portal/invoices — list of GST tax invoices issued to the customer.
 *
 * "Download PDF" links straight to the existing PDF generator URL used
 * elsewhere in the app. For now just lists invoices — PDF generation
 * happens server-side via the existing /lib/pdf pipeline.
 */
import { requirePortalSession } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { rupee, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, "emerald" | "amber" | "rose" | "slate"> = {
  paid:    "emerald",
  pending: "amber",
  overdue: "rose",
  void:    "slate",
  draft:   "slate",
};

export default async function PortalInvoicesPage() {
  await requirePortalSession();
  const supabase = createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount, net_payable, status, invoice_date, due_date, paid_date, gst_irn")
    .order("invoice_date", { ascending: false });

  const rows = invoices ?? [];

  const totalOutstanding = rows
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((s, i) => s + (i.net_payable ?? i.amount), 0);

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Tax Invoices</h1>
        <p className="text-sm text-ink-3 mt-1">
          GST tax invoices issued to your account · HSN 998313 · 18% GST.
        </p>
      </div>

      {totalOutstanding > 0 && (
        <Card className="p-4 mb-6 border-rose/40 bg-rose-soft/30">
          <div className="text-sm text-ink-2">
            <b>{rupee(totalOutstanding)}</b> outstanding across your unpaid invoices.
            Pay via UPI / NEFT / Razorpay and Pardeep will mark them cleared.
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-3">
          No invoices issued yet. They appear here once Pardeep raises a tax
          invoice against your paid order.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
              <tr>
                <th className="text-left  px-4 py-3">Invoice #</th>
                <th className="text-left  px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Net payable</th>
                <th className="text-left  px-4 py-3">IRN</th>
                <th className="text-left  px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((inv) => (
                <tr key={inv.id} className="hover:bg-paper-2/40">
                  <td className="px-4 py-3 font-mono text-ink">{inv.id}</td>
                  <td className="px-4 py-3 text-ink-3">{formatDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-2">{rupee(inv.amount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                    {rupee(inv.net_payable ?? inv.amount)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-ink-3 max-w-[140px] truncate">
                    {inv.gst_irn ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[inv.status] ?? "slate"}>{inv.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/portal/invoice/${encodeURIComponent(inv.id)}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-ink hover:underline"
                    >
                      PDF ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6 text-[11px] text-ink-3 text-center">
        Questions about an invoice? WhatsApp Pardeep on{" "}
        <a href="https://wa.me/919999930300" target="_blank" rel="noopener noreferrer" className="text-amber-ink hover:underline">
          +91 99999 30300
        </a>
      </div>
    </div>
  );
}
