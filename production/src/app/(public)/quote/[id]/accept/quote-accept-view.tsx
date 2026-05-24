/**
 * QuoteAcceptView — client component for the public quote-accept page.
 * Handles billing-cycle aware display + accept/reject actions.
 */
"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { rupee, formatDate } from "@/lib/utils";
import type { Quote, QuoteLineItem, LineCommitment } from "@/lib/supabase/database.types";

function invoicesPerYear(c?: LineCommitment): number {
  if (c === "annual_yearly")       return 1;
  if (c === "annual_half_yearly")  return 2;
  if (c === "annual_quarterly")    return 4;
  return 12;
}
function billingUnitLabel(c?: LineCommitment): string {
  if (c === "annual_yearly")       return "/yr";
  if (c === "annual_half_yearly")  return "/half-yr";
  if (c === "annual_quarterly")    return "/qtr";
  return "/mo";
}
function billingScheduleLabel(c?: LineCommitment): string {
  if (c === "monthly")             return "Monthly (flex)";
  if (c === "annual_monthly")      return "Annual commit · monthly billing";
  if (c === "annual_quarterly")    return "Annual commit · quarterly billing";
  if (c === "annual_half_yearly")  return "Annual commit · half-yearly billing";
  if (c === "annual_yearly")       return "Annual commit · single yearly invoice";
  return "Annual";
}

interface Props {
  quote:         Quote;
  lineItems:     QuoteLineItem[];
  tenantName:    string;
  tenantGstin:   string | null;
  tenantEmail:   string | null;
  tenantPhone?:  string | null;
  tenantAddress?: string | null;
}

export function QuoteAcceptView({
  quote, lineItems, tenantName, tenantGstin, tenantEmail, tenantPhone, tenantAddress,
}: Props) {
  const [accepting, setAccepting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(quote.status === "accepted");

  const discount = Math.round(quote.subtotal * (quote.discount_pct / 100));
  const taxable  = quote.subtotal - discount;
  const tax      = Math.round(taxable * (quote.tax_rate / 100));
  const total    = quote.amount ?? taxable + tax;

  const firstCommitment = lineItems[0]?.commitment;
  const sharedBilling =
    lineItems.length > 0 &&
    lineItems.every(l => invoicesPerYear(l.commitment) === invoicesPerYear(firstCommitment));
  const billingN    = sharedBilling ? invoicesPerYear(firstCommitment) : 1;
  const billingUnit = sharedBilling ? billingUnitLabel(firstCommitment) : "";
  const perInvoice  = sharedBilling && billingN > 1;
  const fmt = (n: number) =>
    perInvoice ? `${rupee(Math.round(n / billingN))}${billingUnit}` : rupee(n);

  const handleAccept = async () => {
    if (!confirm(`Accept quote ${quote.id} for ${rupee(total)}?\n\nWe'll notify ${tenantName} and share payment instructions.`)) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/public/quote/${quote.id}/accept`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not accept");
      setAccepted(true);
      toast.success("Quote accepted · the reseller has been notified");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  const handleRequestChanges = () => {
    if (!tenantEmail) {
      toast.info("Reach out to the reseller via the email they sent you.");
      return;
    }
    const subject = `Changes requested on quote ${quote.id}`;
    const body =
      `Hi ${tenantName},\n\nI'd like to discuss some changes on quote ${quote.id} (total ${rupee(total)}) before accepting.\n\n` +
      `My questions / changes:\n\n[Type your message here]\n\nThanks,\n${quote.customer_name}`;
    window.location.href = `mailto:${tenantEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // ──────────── Thank-you screen ────────────
  if (accepted) {
    return (
      <div className="min-h-screen bg-paper-2/30 flex items-start justify-center py-10 px-4">
        <div className="max-w-2xl w-full bg-paper rounded-xl shadow-sm border border-hairline p-8 md:p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald/15 grid place-items-center">
            <Icon name="check_circle" size={32} className="text-emerald" />
          </div>
          <h1 className="font-serif text-3xl text-ink mb-2">Quote accepted</h1>
          <p className="text-sm text-ink-3">
            <b className="text-ink">{tenantName}</b> has been notified. You'll receive an email
            shortly with the GST-compliant invoice and payment instructions.
          </p>
          <div className="bg-paper-2 rounded-lg p-4 mt-6 text-sm text-left">
            <div className="flex justify-between mb-1.5">
              <span className="text-ink-3">Quote ID</span>
              <span className="font-mono font-semibold">{quote.id}</span>
            </div>
            <div className="flex justify-between mb-1.5">
              <span className="text-ink-3">Total</span>
              <span className="font-serif text-lg">{rupee(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Billing</span>
              <span>{billingScheduleLabel(firstCommitment)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            icon="printer"
            className="mt-6"
            onClick={() => window.print()}
          >
            Print this confirmation
          </Button>
        </div>
      </div>
    );
  }

  // ──────────── Quote review screen ────────────
  return (
    <div className="min-h-screen bg-paper-2/30 py-6 px-4">
      <div className="max-w-3xl mx-auto bg-paper rounded-xl shadow-sm border border-hairline overflow-hidden">
        {/* Top action bar — sticky, hidden in print */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-hairline bg-paper-2 print:hidden sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Icon name="file" size={16} className="text-ink-3" />
            <span className="text-sm font-semibold text-ink">Your quote · review and accept</span>
          </div>
          <Button size="sm" icon="file" variant="ghost" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>

        {/* ── PDF-style document ── */}
        <div className="p-8 md:p-12 print:p-0 font-sans text-ink">
          {/* Brand header */}
          <div className="flex items-start justify-between border-b-2 border-ink pb-5 mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-md bg-ink text-paper grid place-items-center font-serif text-2xl">
                {tenantName.charAt(0)}
              </div>
              <div>
                <div className="font-serif text-2xl leading-tight">{tenantName}</div>
                {tenantGstin && (
                  <div className="text-xs text-ink-3 mt-0.5">
                    GSTIN: <span className="font-mono">{tenantGstin}</span>
                  </div>
                )}
                {tenantAddress && (
                  <div className="text-xs text-ink-3 mt-0.5 max-w-[280px]">{tenantAddress}</div>
                )}
                {(tenantEmail || tenantPhone) && (
                  <div className="text-xs text-ink-3 font-mono mt-0.5">
                    {tenantEmail}
                    {tenantEmail && tenantPhone && " · "}
                    {tenantPhone}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold">Quotation</p>
              <p className="font-serif text-3xl mt-1">{quote.id}</p>
              {quote.expires_date && (
                <p className="text-xs text-ink-3 mt-1">
                  Valid until: <b>{formatDate(quote.expires_date)}</b>
                </p>
              )}
            </div>
          </div>

          {/* Bill to + billing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-1.5">Prepared for</p>
              <p className="font-serif text-lg leading-tight">{quote.customer_name}</p>
            </div>
            <div className="sm:text-right">
              {sharedBilling && firstCommitment && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-1.5">Billing schedule</p>
                  <p className="text-sm">{billingScheduleLabel(firstCommitment)}</p>
                  {billingN > 1 && (
                    <p className="text-[11px] text-ink-3">{billingN} invoices per year</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Line items */}
          <table className="w-full mb-6">
            <thead className="border-y-2 border-ink">
              <tr>
                <th className="text-left py-2 text-[11px] uppercase tracking-wider font-semibold">Item</th>
                <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold w-16">Qty</th>
                <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold w-28">Rate</th>
                <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line) => {
                const lineN    = invoicesPerYear(line.commitment);
                const lineUnit = billingUnitLabel(line.commitment);
                const showPer  = lineN > 1;
                const rate     = showPer ? Math.round(line.rate / lineN) : line.rate;
                const amount   = line.qty * rate;
                return (
                  <tr key={line.id} className="border-b border-hairline">
                    <td className="py-3 text-sm">
                      <p className="font-medium">{line.name}</p>
                      {line.commitment && (
                        <p className="text-[11px] text-ink-3 mt-0.5">
                          {billingScheduleLabel(line.commitment)}
                        </p>
                      )}
                    </td>
                    <td className="py-3 text-right text-sm tabular-nums">{line.qty}</td>
                    <td className="py-3 text-right text-sm tabular-nums">
                      {rupee(rate)}{showPer ? lineUnit : ""}
                    </td>
                    <td className="py-3 text-right text-sm tabular-nums font-medium">
                      {rupee(amount)}{showPer ? lineUnit : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <Row label="Subtotal" value={fmt(quote.subtotal)} />
              {quote.discount_pct > 0 && (
                <Row label={`Discount (${quote.discount_pct}%)`} value={`−${fmt(discount)}`} accent />
              )}
              <Row label="Taxable" value={fmt(taxable)} />
              <Row label={`GST (${quote.tax_rate}%)`} value={fmt(tax)} />
              <div className="border-t-2 border-ink pt-2 mt-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] uppercase tracking-widest font-semibold">
                    {/* Annual upfront (single yearly invoice) → emphasize "payable now"
                        so customer knows full amount needs to clear in one go. */}
                    {perInvoice ? `Per invoice (${billingN}/yr)` : (billingN === 1 ? "Total payable now" : "Total")}
                  </span>
                  <span className="font-serif text-2xl tabular-nums">
                    {perInvoice
                      ? `${rupee(Math.round(total / billingN))}${billingUnit}`
                      : rupee(total)}
                  </span>
                </div>
                {perInvoice && (
                  <div className="flex justify-between items-baseline mt-1.5 text-ink-3">
                    <span className="text-[11px]">Annual contract value</span>
                    <span className="text-sm tabular-nums">{rupee(total)}/yr</span>
                  </div>
                )}
                {!perInvoice && billingN === 1 && (
                  <div className="mt-1.5 text-[11px] text-emerald font-medium">
                    ✓ One-time payment · covers full 12 months of service
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="mb-6 pt-4 border-t border-hairline">
              <p className="text-[10px] uppercase tracking-widest text-ink-3 font-semibold mb-1.5">Notes</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-ink-2">{quote.notes}</p>
            </div>
          )}

          {/* Action zone — hidden in print */}
          <div className="pt-6 mt-6 border-t border-hairline print:hidden space-y-3">
            <Button
              variant="primary"
              size="lg"
              icon="check_circle"
              loading={accepting}
              onClick={handleAccept}
              className="w-full justify-center"
            >
              Accept this quote · {rupee(total)}
            </Button>
            <Button
              variant="ghost"
              icon="mail"
              onClick={handleRequestChanges}
              className="w-full justify-center"
            >
              Request changes
            </Button>
            <p className="text-[11px] text-ink-3 text-center leading-relaxed pt-2">
              By accepting, you agree to the pricing and billing terms shown above. {tenantName} will
              issue a GST invoice with payment instructions. No payment is taken on this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-ink-3">{label}</span>
      <span className={`tabular-nums ${accent ? "text-emerald" : "text-ink"}`}>{value}</span>
    </div>
  );
}
