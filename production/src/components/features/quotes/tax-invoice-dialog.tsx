/**
 * TaxInvoiceDialog — GST-compliant Tax Invoice (CGST Section 31).
 *
 * Difference from ReceiptVoucher:
 *   - Receipt voucher = "advance received" proof; ITC NOT claimable
 *   - Tax invoice     = "supply made" proof;     ITC IS claimable by customer
 *
 * Legal requirement (Section 31 + Rule 53): if advances were received earlier
 * against this supply (and Receipt Vouchers were issued), the final invoice MUST
 * reference those vouchers and show the net payable after adjustment. Otherwise
 * the customer's ITC chain breaks at audit.
 */
"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate } from "@/lib/utils";
import type { Invoice, Payment, QuoteLineItem } from "@/lib/supabase/database.types";

/** Display-shape for advance rows in the dialog — works for both frozen + live data */
interface DisplayAdvance {
  id:          string;         // unique React key
  voucher_no:  string | null;
  amount:      number;
  received_at: string;
  method:      string;
}

interface Props {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  invoice:      Invoice;

  /** Quote data — line items, discount, tax rate (so we can re-render the breakdown) */
  lineItems:    QuoteLineItem[];
  subtotal:     number;
  discountPct:  number;
  discount:     number;
  taxable:      number;
  taxRate:      number;
  tax:          number;
  total:        number;

  /**
   * Live payments against the parent quote — used ONLY when the invoice
   * doesn't yet have a frozen adjusted_advances snapshot (legacy data).
   * For new invoices generated after migration 0005, the dialog reads
   * directly from invoice.adjusted_advances to preserve the immutable
   * record (refunds become credit notes, not edits to original invoice).
   */
  receivedPayments?: Payment[];

  /** Place-of-supply: customer state vs tenant state (different → IGST) */
  interState?:  boolean;

  /** Customer info */
  customerGstin?:   string | null;
  customerEmail?:   string | null;
  customerAddress?: string | null;
  customerState?:   string | null;

  /** Tenant (supplier) info */
  tenantName:    string;
  tenantGstin?:  string | null;
  tenantEmail?:  string | null;
  tenantPhone?:  string | null;
  tenantAddress?: string | null;
  tenantState?:   string | null;
}

export function TaxInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  lineItems,
  subtotal,
  discountPct,
  discount,
  taxable,
  taxRate,
  tax,
  total,
  receivedPayments,
  interState = false,
  customerGstin,
  customerEmail,
  customerAddress,
  customerState,
  tenantName,
  tenantGstin,
  tenantEmail,
  tenantPhone,
  tenantAddress,
  tenantState,
}: Props) {
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);

  const cgst = interState ? 0 : Math.round(tax / 2);
  const sgst = interState ? 0 : tax - cgst;
  const igst = interState ? tax : 0;

  // ── Advance adjustment ────────────────────────────────────────────────
  // Prefer FROZEN snapshot from invoice itself (legally correct — once issued,
  // an invoice is immutable; later refunds get a separate Credit Note).
  // Fall back to live payments only if the invoice predates migration 0005.
  const frozen = invoice.adjusted_advances ?? [];
  const displayAdvances: DisplayAdvance[] = frozen.length > 0
    ? frozen.map((a) => ({
        id:          a.payment_id,
        voucher_no:  a.voucher_no,
        amount:      a.amount,
        received_at: a.received_at,
        method:      a.method,
      }))
    : (receivedPayments ?? []).map((p) => ({
        id:          p.id,
        voucher_no:  p.receipt_voucher_no,
        amount:      p.amount,
        received_at: p.received_at,
        method:      p.method,
      }));

  const advancesAdjusted = displayAdvances.reduce((s, a) => s + a.amount, 0);
  // Prefer frozen net_payable from invoice — guaranteed to match what was issued
  const netPayable       = invoice.net_payable ?? Math.max(0, total - advancesAdjusted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Tax Invoice · {invoice.id}</DialogTitle>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-hairline bg-paper-2 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <Icon name="receipt" size={16} className="text-ink-3" />
            <span className="text-sm font-semibold text-ink">Tax Invoice · GST-compliant</span>
            {advancesAdjusted > 0 && (
              <span className="text-[10px] uppercase tracking-wider bg-emerald-soft text-emerald-ink px-2 py-0.5 rounded-full font-semibold">
                ₹{advancesAdjusted.toLocaleString("en-IN")} advance adjusted
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              icon="download"
              loading={downloadingPdf}
              onClick={async () => {
                setDownloadingPdf(true);
                try {
                  const { downloadInvoicePDF } = await import("@/lib/pdf");
                  await downloadInvoicePDF({
                    invoice, lineItems, subtotal, discountPct, discount,
                    taxable, taxRate, tax, total, interState,
                    customerGstin, customerEmail, customerAddress, customerState,
                    tenantName, tenantGstin, tenantEmail, tenantPhone,
                    tenantAddress, tenantState,
                  });
                } catch (err) {
                  console.error("Invoice PDF failed:", err);
                } finally {
                  setDownloadingPdf(false);
                }
              }}
            >
              Download PDF
            </Button>
            <Button size="sm" variant="ghost" icon="x" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        {/* PDF body */}
        <div className="bg-paper p-10 print:p-0 font-sans text-ink">

          {/* Header */}
          <div className="text-center mb-4">
            <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold">
              Original for recipient · GST-compliant
            </p>
            <h1 className="font-serif text-3xl mt-1">Tax Invoice</h1>
            <p className="font-mono text-sm text-ink-2 mt-1">{invoice.id}</p>
            {invoice.gst_irn && (
              <p className="font-mono text-[10px] text-ink-3 mt-0.5">IRN: {invoice.gst_irn}</p>
            )}
          </div>

          {/* Supplier + Recipient */}
          <div className="grid grid-cols-2 gap-6 mb-6 border-y-2 border-ink py-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-1.5">From (Supplier)</p>
              <p className="font-serif text-lg leading-tight">{tenantName}</p>
              {tenantGstin && (
                <p className="text-xs text-ink-2 mt-0.5 font-mono">GSTIN: {tenantGstin}</p>
              )}
              {tenantAddress && (
                <p className="text-xs text-ink-3 mt-0.5">{tenantAddress}</p>
              )}
              {tenantState && (
                <p className="text-xs text-ink-3 mt-0.5">State: {tenantState}</p>
              )}
              {tenantEmail && <p className="text-xs text-ink-3 font-mono">{tenantEmail}</p>}
              {tenantPhone && <p className="text-xs text-ink-3 font-mono">{tenantPhone}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-1.5">Bill To (Recipient)</p>
              <p className="font-serif text-lg leading-tight">{invoice.customer_name}</p>
              {customerGstin && (
                <p className="text-xs text-ink-2 mt-0.5 font-mono">GSTIN: {customerGstin}</p>
              )}
              {customerAddress && <p className="text-xs text-ink-3 mt-0.5">{customerAddress}</p>}
              {customerState && <p className="text-xs text-ink-3 mt-0.5">State: {customerState}</p>}
              {customerEmail && <p className="text-xs text-ink-3 font-mono">{customerEmail}</p>}
            </div>
          </div>

          {/* Invoice meta */}
          <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-0.5">Invoice No.</p>
              <p className="font-mono">{invoice.id}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-0.5">Invoice Date</p>
              <p>{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-0.5">Due Date</p>
              <p>{invoice.due_date ? formatDate(invoice.due_date) : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-0.5">Place of supply</p>
              <p>{interState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}</p>
            </div>
          </div>

          {/* Line items */}
          <div className="border-2 border-ink rounded-md overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-paper-2 border-b border-ink">
                <tr>
                  <th className="text-left  p-2.5 text-[10px] uppercase tracking-wider font-semibold w-8">#</th>
                  <th className="text-left  p-2.5 text-[10px] uppercase tracking-wider font-semibold">Description</th>
                  <th className="text-left  p-2.5 text-[10px] uppercase tracking-wider font-semibold w-20">HSN/SAC</th>
                  <th className="text-right p-2.5 text-[10px] uppercase tracking-wider font-semibold w-16">Qty</th>
                  <th className="text-right p-2.5 text-[10px] uppercase tracking-wider font-semibold w-24">Rate</th>
                  <th className="text-right p-2.5 text-[10px] uppercase tracking-wider font-semibold w-28">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-3 text-center text-sm text-ink-3 italic">
                      No line items recorded on the parent quote.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((li, i) => (
                    <tr key={li.id} className="border-b border-hairline last:border-0">
                      <td className="p-2.5 text-xs text-ink-3">{i + 1}</td>
                      <td className="p-2.5 text-sm">
                        <p className="font-medium">{li.name}</p>
                        {li.description && (
                          <p className="text-[11px] text-ink-3 mt-0.5">{li.description}</p>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-ink-2">998313</td>
                      <td className="p-2.5 text-right tabular-nums text-sm">{li.qty}</td>
                      <td className="p-2.5 text-right tabular-nums text-sm">{rupee(li.rate)}</td>
                      <td className="p-2.5 text-right tabular-nums text-sm font-medium">
                        {rupee(li.qty * li.rate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals block — right-aligned */}
          <div className="flex justify-end mb-6">
            <table className="w-80 text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-ink-3">Subtotal</td>
                  <td className="py-1 text-right tabular-nums">{rupee(subtotal)}</td>
                </tr>
                {discountPct > 0 && (
                  <tr>
                    <td className="py-1 text-ink-3">Discount ({discountPct}%)</td>
                    <td className="py-1 text-right tabular-nums text-rose">− {rupee(discount)}</td>
                  </tr>
                )}
                <tr className="border-t border-hairline">
                  <td className="py-1 text-ink-3">Taxable value</td>
                  <td className="py-1 text-right tabular-nums">{rupee(taxable)}</td>
                </tr>
                {interState ? (
                  <tr>
                    <td className="py-1 text-ink-3">IGST @ {taxRate}%</td>
                    <td className="py-1 text-right tabular-nums">{rupee(igst)}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td className="py-1 text-ink-3">CGST @ {taxRate / 2}%</td>
                      <td className="py-1 text-right tabular-nums">{rupee(cgst)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-ink-3">SGST @ {taxRate / 2}%</td>
                      <td className="py-1 text-right tabular-nums">{rupee(sgst)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-t-2 border-ink">
                  <td className="py-2 font-semibold uppercase tracking-wider text-[11px]">
                    Invoice total
                  </td>
                  <td className="py-2 text-right">
                    <span className="font-serif text-xl tabular-nums">{rupee(total)}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Advance adjustment section (CGST Sec 31 + Rule 53) ── */}
          {advancesAdjusted > 0 && (
            <div className="rounded-md bg-emerald-soft/40 border border-emerald/30 p-4 mb-6">
              <p className="text-[10px] uppercase tracking-widest text-emerald-ink font-semibold mb-2 flex items-center gap-1.5">
                <Icon name="check_circle" size={12} />
                Advances adjusted against this invoice
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-emerald/20">
                    <th className="text-left  py-1.5 font-semibold text-ink-3 w-32">Voucher No.</th>
                    <th className="text-left  py-1.5 font-semibold text-ink-3">Received on</th>
                    <th className="text-left  py-1.5 font-semibold text-ink-3 w-32">Method</th>
                    <th className="text-right py-1.5 font-semibold text-ink-3 w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {displayAdvances.map((a) => (
                    <tr key={a.id} className="border-b border-emerald/10 last:border-0">
                      <td className="py-1.5 font-mono text-[11px]">
                        {a.voucher_no ?? <span className="italic text-ink-3">(unnumbered)</span>}
                      </td>
                      <td className="py-1.5 text-ink-2">{formatDate(a.received_at)}</td>
                      <td className="py-1.5 text-ink-2 capitalize">{a.method.replace("_", " ")}</td>
                      <td className="py-1.5 text-right tabular-nums">{rupee(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-emerald/30">
                    <td colSpan={3} className="py-2 font-semibold text-emerald-ink">Total adjusted</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-ink">
                      − {rupee(advancesAdjusted)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Net payable */}
          <div className="flex justify-end mb-6">
            <div className="w-80 border-2 border-ink rounded-md p-4 bg-paper-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] uppercase tracking-widest font-semibold text-ink-3">
                  {advancesAdjusted > 0 ? "Net payable" : "Amount due"}
                </span>
                <span className="font-serif text-3xl tabular-nums">{rupee(netPayable)}</span>
              </div>
              {advancesAdjusted > 0 && netPayable === 0 && (
                <p className="text-[11px] text-emerald-ink mt-1.5 flex items-center gap-1">
                  <Icon name="check_circle" size={11} />
                  Fully settled via advance payments — no further amount due.
                </p>
              )}
            </div>
          </div>

          {/* Amount in words */}
          <p className="text-xs text-ink-3 mb-6">
            <b>Invoice total (in words):</b> {amountInWords(total)} only.
            {advancesAdjusted > 0 && (
              <>
                {" · "}
                <b>Net payable (in words):</b> {amountInWords(netPayable)} only.
              </>
            )}
          </p>

          {/* Compliance footer */}
          <div className="rounded-md bg-amber-soft border border-amber/30 p-3 text-[11px] text-amber-ink mb-6">
            <p className="font-semibold mb-1">📋 GST treatment</p>
            <p>
              This is a Tax Invoice issued under <b>CGST Section 31</b>. Recipient may claim
              Input Tax Credit (ITC) of ₹{tax.toLocaleString("en-IN")} subject to compliance
              with CGST Section 16.
              {advancesAdjusted > 0 && (
                <>
                  {" "}
                  Advances of <b>{rupee(advancesAdjusted)}</b> received earlier (against
                  Receipt Voucher{displayAdvances.length === 1 ? "" : "s"}{" "}
                  {displayAdvances.map((a) => a.voucher_no).filter(Boolean).join(", ")})
                  have been adjusted against this invoice as required by{" "}
                  <b>Rule 53 of CGST Rules</b>.
                </>
              )}
            </p>
          </div>

          {/* Signature */}
          <div className="mt-10 pt-6 border-t border-hairline grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-8">
                Customer acknowledgment
              </p>
              <div className="h-px bg-ink w-32" />
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-8">
                For {tenantName}
              </p>
              <div className="h-px bg-ink w-32 ml-auto" />
              <p className="text-[11px] text-ink-3 mt-1">Authorized signatory</p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-ink-3 mt-8">
            This is a system-generated tax invoice — valid without seal.
            {invoice.gst_irn && " IRN attested by NIC."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────── Amount in words (Indian) ──────────────────────
function amountInWords(n: number): string {
  if (n === 0) return "Rupees Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const two = (n: number): string => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };
  const three = (n: number): string => {
    if (n < 100) return two(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + two(n % 100) : "");
  };

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  if (crore > 0) {
    parts.push(three(crore) + " Crore");
    n %= 10000000;
  }
  const lakh = Math.floor(n / 100000);
  if (lakh > 0) {
    parts.push(three(lakh) + " Lakh");
    n %= 100000;
  }
  const thousand = Math.floor(n / 1000);
  if (thousand > 0) {
    parts.push(three(thousand) + " Thousand");
    n %= 1000;
  }
  if (n > 0) parts.push(three(n));

  return "Rupees " + parts.join(" ");
}
