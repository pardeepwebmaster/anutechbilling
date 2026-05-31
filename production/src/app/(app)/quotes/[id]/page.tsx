/**
 * /quotes/[id] — quote detail page with status + payment workflow + invoice action.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useQuote } from "@/lib/queries/quotes";
import { useGenerateInvoice } from "@/lib/queries/invoices";
import { isInterStateSupply } from "@/lib/gst/place-of-supply";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ActivityTimeline, type TimelineEvent } from "@/components/shared/activity-timeline";
import { MarginPill, computeMargin } from "@/components/features/margin-pill";
import { RecordPaymentDialog } from "@/components/features/quotes/record-payment-dialog";
import { QuotePreviewDialog } from "@/components/features/quotes/quote-preview-dialog";
import { ReceiptVoucherDialog } from "@/components/features/quotes/receipt-voucher-dialog";
import { SendQuoteDialog } from "@/components/features/quotes/send-quote-dialog";
import SendWhatsAppDialog from "@/components/features/whatsapp/send-whatsapp-dialog";
import { usePaymentsByQuote, totalReceived as sumReceived } from "@/lib/queries/payments";
import { useCustomer } from "@/lib/queries/customers";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { rupee, formatDate, daysBetween } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Quote, QuoteLineItem, Payment } from "@/lib/supabase/database.types";

// ============================================================
// Status meta
// ============================================================
const STATUS_META: Record<Quote["status"], { kind: "muted" | "success" | "warning" | "danger" | "info"; label: string }> = {
  draft:    { kind: "muted",   label: "Draft" },
  sent:     { kind: "warning", label: "Sent" },
  viewed:   { kind: "info",    label: "Viewed" },
  accepted: { kind: "success", label: "Accepted" },
  rejected: { kind: "danger",  label: "Rejected" },
  expired:  { kind: "danger",  label: "Expired" },
};

const PAYMENT_META: Record<Quote["payment_status"], { kind: "muted" | "success" | "warning" | "info" | "danger"; label: string }> = {
  none:     { kind: "muted",   label: "Not awaiting" },
  awaiting: { kind: "warning", label: "Awaiting payment" },
  partial:  { kind: "info",    label: "Partially paid" },
  received: { kind: "info",    label: "Payment received" },
  invoiced: { kind: "success", label: "Invoiced" },
};

// ============================================================
// Page
// ============================================================
export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: quote, isLoading, error } = useQuote(params.id);
  const { data: paymentHistory } = usePaymentsByQuote(params.id);
  const { data: customer } = useCustomer(quote?.customer_id ?? undefined);
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [receiptPayment, setReceiptPayment] = React.useState<Payment | null>(null);
  const [sendOpen,    setSendOpen]    = React.useState(false);
  const [whatsOpen,   setWhatsOpen]   = React.useState(false);

  // Auto-open a send dialog when the builder redirected here with ?send=
  // (?send=whatsapp or ?send=email). Use a ref to only fire once per
  // navigation so closing the dialog doesn't immediately re-open it.
  const searchParams = useSearchParams();
  const sendIntent   = searchParams.get("send");
  const sendIntentHandled = React.useRef(false);
  React.useEffect(() => {
    if (sendIntentHandled.current) return;
    if (!quote)                     return;            // wait for data
    if (sendIntent === "whatsapp" && customer?.contact_phone) {
      setWhatsOpen(true);
      sendIntentHandled.current = true;
      router.replace(`/quotes/${quote.id}` as never);   // clean the URL
    } else if (sendIntent === "email") {
      setSendOpen(true);
      sendIntentHandled.current = true;
      router.replace(`/quotes/${quote.id}` as never);
    }
  }, [sendIntent, quote, customer?.contact_phone, router]);

  const totalReceivedSoFar = sumReceived(paymentHistory ?? []);

  // Inter-state? Compare customer state code vs tenant (seller) state code.
  const interState = isInterStateSupply(customer?.state_code, me?.tenantStateCode);

  // ────────── Mutations ──────────
  const sendQuote = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("quotes").update({ status: "sent" }).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", params.id] });
      toast.success("Quote marked as sent");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * Mark accepted (without payment) — calls accept_quote RPC which:
   *   - Sets quote.status = 'accepted'
   *   - Converts lead → customer (so the customer record exists immediately,
   *     even before payment lands)
   *   - Marks lead.stage = 'won'
   * Subscription is still created later via record_payment when money arrives.
   */
  const markAccepted = useMutation({
    mutationFn: async () => {
      const res  = await fetch(`/api/quotes/${params.id}/mark-accepted`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not mark as accepted");
      return json as { customerId: string; convertedNow: boolean };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", params.id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        data.convertedNow
          ? "Quote accepted · customer record created · awaiting payment"
          : "Quote accepted · awaiting payment",
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const markRejected = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("quotes").update({ status: "rejected" }).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", params.id] });
      toast("Quote marked as rejected");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Use the central useGenerateInvoice hook — it calls next_document_number RPC
  // (sequential GST-compliant), compute_advance_adjustment RPC (frozen
  // snapshot per Rule 53), and links quote_id correctly. The previous local
  // implementation used Math.random() which broke all three properties.
  const generateInvoice = useGenerateInvoice();

  // ────────── Loading / Error ──────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <EmptyState
          icon="alert"
          title={error ? "Could not load quote" : "Quote not found"}
          body={error?.message ?? "This quote does not exist in your tenant."}
          action={
            <Button asChild variant="primary" icon="file">
              <Link href={"/quotes" as any}>Back to quotes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // ────────── Derived ──────────
  const status = STATUS_META[quote.status];
  const payment = PAYMENT_META[quote.payment_status];
  const items: QuoteLineItem[] = Array.isArray(quote.line_items) ? quote.line_items : [];
  const discount = Math.round(quote.subtotal * (quote.discount_pct / 100));
  const taxable = quote.subtotal - discount;
  const tax = Math.round(taxable * (quote.tax_rate / 100));
  const total = quote.amount ?? taxable + tax;
  const margin = computeMargin(quote.total_cost, taxable);
  const daysLeft = quote.expires_date ? daysBetween(new Date(), quote.expires_date) : null;

  // Activity timeline
  const events: TimelineEvent[] = [
    { icon: "file", kind: "indigo", title: "Quote created",
      body: `Draft created with ${items.length} line items`,
      time: formatDate(quote.created_date, "long") },
  ];
  if (quote.status !== "draft") {
    events.push({ icon: "send", kind: "indigo", title: "Sent to customer", body: `Quote shared with ${quote.customer_name}`, time: formatDate(quote.updated_at, "long") });
  }
  if (quote.status === "accepted") {
    events.push({ icon: "check_circle", kind: "emerald", title: "Customer accepted", body: "Quote accepted · payment workflow started", time: formatDate(quote.updated_at, "long") });
  }
  if (quote.payment_status === "received" || quote.payment_status === "invoiced") {
    events.push({
      icon: "rupee", kind: "emerald", title: `Payment received · ${rupee(quote.payment_amount ?? total)}`,
      body: `${quote.payment_method?.toUpperCase()} · ref: ${quote.payment_reference}`,
      time: quote.payment_received_at ? formatDate(quote.payment_received_at, "long") : "Recently",
    });
  }
  if (quote.payment_status === "invoiced" && quote.invoice_id) {
    events.push({
      icon: "receipt", kind: "emerald", title: `Invoice ${quote.invoice_id} generated`,
      body: "GST e-invoice ready",
      time: formatDate(quote.updated_at, "long"),
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <IconButton icon="arrow_left" aria-label="Back" onClick={() => router.push("/quotes" as any)} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">
              Revenue · {quote.is_extension ? "Extension Quote" : quote.is_renewal ? "Renewal Quote" : "Quote"}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">
              {quote.id}
            </h1>
            <p className="text-sm text-ink-3 mt-1 flex items-center gap-2 flex-wrap">
              <span>For <b className="text-ink">{quote.customer_name}</b></span>
              <span>·</span>
              <Badge kind={status.kind} dot>{status.label}</Badge>
              {quote.is_extension ? (
                <>
                  <span>·</span>
                  <Badge kind="warning">Extension · {Math.round((quote.extension_months ?? 12) / 12)} yr</Badge>
                </>
              ) : quote.is_renewal && (
                <>
                  <span>·</span>
                  <Badge kind="info">Renewal</Badge>
                </>
              )}
              {quote.payment_status !== "none" && (
                <>
                  <span>·</span>
                  <Badge kind={payment.kind} dot>{payment.label}</Badge>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button icon="file" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button
            icon="download"
            loading={downloadingPdf}
            onClick={async () => {
              setDownloadingPdf(true);
              try {
                const { downloadQuotePDF } = await import("@/lib/pdf");
                await downloadQuotePDF({
                  tenantName:    me?.tenantName    ?? "Workspace",
                  tenantGstin:   me?.tenantGstin,
                  tenantEmail:   me?.tenantEmail,
                  tenantPhone:   me?.tenantPhone,
                  tenantAddress: me?.tenantAddress,
                  quoteId:       quote.id,
                  customerName:  quote.customer_name,
                  contactName:   null,
                  contactEmail:  null,
                  contactPhone:  null,
                  createdDate:   quote.created_at,
                  expiresDate:   quote.expires_date,
                  validityDays:  quote.expires_date
                    ? Math.max(1, daysBetween(new Date(quote.created_at), quote.expires_date))
                    : 30,
                  lineItems:     items,
                  subtotal:      quote.subtotal,
                  discountPct:   quote.discount_pct,
                  discount,
                  taxable,
                  taxRate:       quote.tax_rate,
                  tax,
                  total,
                  interState,
                  notes:         quote.notes ?? "",
                });
                toast.success(`${quote.id}.pdf downloaded`);
              } catch (err) {
                toast.error(`PDF generation failed: ${(err as Error).message}`);
              } finally {
                setDownloadingPdf(false);
              }
            }}
          >
            Download PDF
          </Button>
          <Button
            icon="copy"
            onClick={() => {
              // Carry lead context forward if this quote was for a prospect
              const params = new URLSearchParams();
              params.set("duplicate", quote.id);
              if (quote.lead_id)       params.set("leadId",  quote.lead_id);
              if (quote.customer_name) params.set("company", quote.customer_name);
              router.push(`/quotes/new?${params.toString()}` as any);
            }}
          >
            Duplicate & edit
          </Button>
          <Button
            icon="link"
            onClick={() => {
              const url = `${window.location.origin}/quote/${quote.id}/accept`;
              navigator.clipboard?.writeText(url);
              toast.success("Customer link copied · share via email or WhatsApp");
            }}
          >
            Copy customer link
          </Button>
          <Button
            icon="mail"
            onClick={() => setSendOpen(true)}
            title="Send quote PDF via email — uses configured email provider (or stub mode in dev)"
          >
            {quote.status === "sent" ? "Resend via email" : "Send via email"}
          </Button>
          {/* WhatsApp send — always shown. Phone is pre-filled when we have
              a customer record with contact_phone; otherwise the dialog
              opens with an empty "To" field for the visitor to type into.
              Label flips to "Resend" when quote is already sent. */}
          <Button
            icon="whatsapp"
            onClick={() => setWhatsOpen(true)}
            title="Send the quote link over WhatsApp — needs Meta Cloud API configured in Settings"
          >
            {quote.status === "sent" || quote.status === "viewed"
              ? "Resend via WhatsApp"
              : "Send via WhatsApp"}
          </Button>
        </div>
      </div>

      {/* Status-aware action bar */}
      <Card>
        {quote.status === "draft" && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-ink-3">This is a draft. Send it to the customer when ready.</div>
            <div className="flex gap-2">
              <Button asChild variant="default" icon="edit">
                <Link href={`/quotes/${quote.id}/edit` as any}>Edit</Link>
              </Button>
              <Button variant="primary" icon="send" loading={sendQuote.isPending} onClick={() => sendQuote.mutate()}>
                Mark as sent
              </Button>
            </div>
          </div>
        )}

        {(quote.status === "sent" || quote.status === "viewed") && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-ink-3">
              {daysLeft !== null && daysLeft > 0 && (
                <>Expires in <b>{daysLeft} days</b> · </>
              )}
              Customer accepted? Mark accepted to convert the lead into a customer.
              {" "}
              <span className="text-ink-2">Payment can land later — record it when received.</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" loading={markRejected.isPending} onClick={() => markRejected.mutate()}>
                Mark rejected
              </Button>
              <Button variant="primary" icon="check_circle" loading={markAccepted.isPending} onClick={() => markAccepted.mutate()}>
                Mark accepted (no payment yet)
              </Button>
              <Button variant="primary" icon="rupee" onClick={() => setPaymentOpen(true)}>
                Record payment now
              </Button>
            </div>
          </div>
        )}

        {quote.status === "accepted" && quote.payment_status === "awaiting" && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-medium text-amber-ink">Awaiting payment of {rupee(total)}</span>{" "}
              <span className="text-ink-3">from {quote.customer_name}. Record payment when received — partial payments supported.</span>
            </div>
            <Button variant="primary" icon="rupee" onClick={() => setPaymentOpen(true)}>
              Record payment
            </Button>
          </div>
        )}

        {quote.status === "accepted" && quote.payment_status === "partial" && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-medium text-indigo">
                Partially paid · {rupee(totalReceivedSoFar)} of {rupee(total)}
              </span>{" "}
              <span className="text-ink-3">
                ({rupee(total - totalReceivedSoFar)} remaining · {paymentHistory?.length ?? 0} payment{(paymentHistory?.length ?? 0) === 1 ? "" : "s"} so far)
              </span>
            </div>
            <Button variant="primary" icon="rupee" onClick={() => setPaymentOpen(true)}>
              Record next payment
            </Button>
          </div>
        )}

        {/* Generate Tax Invoice — legally allowed both for fully-received AND
            partial-paid quotes per CGST §13(2) (supply triggers invoicing,
            not full payment) + Rule 47 (30-day clock from first advance).
            The frozen advance-adjustment snapshot in the Invoice PDF shows
            customer exactly how much was already received via RV(s) and
            what's still due. */}
        {quote.status === "accepted"
          && (quote.payment_status === "received" || quote.payment_status === "partial") && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              {quote.payment_status === "received" ? (
                <>
                  <span className="font-medium text-emerald">
                    ✓ Payment of {rupee(quote.payment_amount ?? total)} received via {quote.payment_method?.toUpperCase()}
                  </span>{" "}
                  <span className="text-ink-3">on {quote.payment_received_at ? formatDate(quote.payment_received_at) : "—"}. You can now generate the GST invoice.</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-amber-ink">
                    ⓘ Partial payment received · {rupee(quote.payment_amount ?? 0)} of {rupee(total)}
                  </span>{" "}
                  <span className="text-ink-3">
                    — service started? Issue the GST invoice now (legally allowed under CGST §13(2)).
                    Net payable on invoice will be <b className="text-ink">{rupee(Math.max(0, total - (quote.payment_amount ?? 0)))}</b>.
                  </span>
                </>
              )}
            </div>
            <Button
              variant="primary"
              icon="receipt"
              loading={generateInvoice.isPending}
              onClick={() => generateInvoice.mutate(params.id)}
            >
              Generate GST Invoice
            </Button>
          </div>
        )}

        {quote.payment_status === "invoiced" && quote.invoice_id && (() => {
          const balanceRemaining = Math.max(0, total - totalReceivedSoFar);
          const hasBalance = balanceRemaining > 0;
          return (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                {hasBalance ? (
                  <>
                    <span className="font-medium text-amber-ink">
                      Invoice issued · {rupee(balanceRemaining)} balance due
                    </span>{" "}
                    <span className="text-ink-3">
                      Customer paid {rupee(totalReceivedSoFar)} of {rupee(total)}. Record balance when received — no new receipt voucher needed (post-invoice).
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-emerald">
                    ✓ Complete · Invoice fully paid
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {hasBalance && (
                  <Button variant="primary" icon="rupee" onClick={() => setPaymentOpen(true)}>
                    Record balance payment
                  </Button>
                )}
                <Button asChild variant={hasBalance ? "ghost" : "primary"} icon="receipt">
                  <Link href={`/invoices` as any}>View invoice {quote.invoice_id}</Link>
                </Button>
              </div>
            </div>
          );
        })()}

        {(quote.status === "rejected" || quote.status === "expired") && (
          <div className="text-sm text-ink-3">
            This quote is {quote.status}. You can duplicate and re-send if needed.
          </div>
        )}
      </Card>

      {/* Line items */}
      <Card title="Line items" sub={`${items.length} item${items.length === 1 ? "" : "s"}`} flush>
        <table className="w-full">
          <thead className="bg-paper-2 border-b border-hairline">
            <tr>
              <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-12">#</th>
              <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Item</th>
              <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-24">Qty</th>
              <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-32">Rate</th>
              <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((line, i) => (
              <tr key={line.id} className="border-b border-hairline last:border-0">
                <td className="p-3 text-sm text-ink-3 tabular-nums">{i + 1}</td>
                <td className="p-3 text-sm font-medium">{line.name}</td>
                <td className="p-3 text-right tabular-nums text-sm">{line.qty}</td>
                <td className="p-3 text-right tabular-nums text-sm">{rupee(line.rate)}</td>
                <td className="p-3 text-right tabular-nums text-sm font-medium">{rupee(line.qty * line.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Totals + Margin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Totals breakdown">
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={rupee(quote.subtotal)} />
            {discount > 0 && <Row label={`Discount (${quote.discount_pct}%)`} value={`−${rupee(discount)}`} tone="emerald" />}
            <Row label="Taxable amount" value={rupee(taxable)} />
            <Row label={`GST (${quote.tax_rate}%)`} value={rupee(tax)} />
            <div className="border-t border-hairline pt-3 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Total</span>
              <span className="font-serif text-2xl text-amber tabular-nums">{rupee(total)}</span>
            </div>
          </div>
        </Card>

        <Card title="Your margin" sub="Post-discount">
          <div className="text-center py-3">
            <div className={cn(
              "font-serif text-5xl leading-none mb-2",
              margin.marginPct >= 18 ? "text-emerald" :
              margin.marginPct >= 14 ? "text-amber-ink" :
              "text-rose"
            )}>
              {rupee(margin.margin, { compact: true })}
            </div>
            <div className="text-sm text-ink-3 mb-3 tabular-nums">{margin.marginPct}% margin</div>
            <MarginPill margin={margin} period="one-time" />
            <div className="text-[11px] text-ink-3 mt-3 tabular-nums">
              Cost: {rupee(margin.cost)} · Price: {rupee(margin.price)}
            </div>
          </div>
        </Card>
      </div>

      {/* Notes */}
      {quote.notes && (
        <Card title="Notes">
          <p className="text-sm text-ink-2 whitespace-pre-wrap">{quote.notes}</p>
        </Card>
      )}

      {/* Payment history (installments) */}
      {paymentHistory && paymentHistory.length > 0 && (
        <Card title="Payment history" sub={`${paymentHistory.length} payment${paymentHistory.length === 1 ? "" : "s"} · ${rupee(totalReceivedSoFar)} of ${rupee(total)} received`}>
          <table className="w-full">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Date</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Amount</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Method</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Reference</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.map((p, idx) => (
                <tr key={p.id} className="border-b border-hairline last:border-0">
                  <td className="p-3 text-xs text-ink-2">
                    <div>{formatDate(p.received_at)}</div>
                    <div className="text-[10px] text-ink-3">#{idx + 1}</div>
                  </td>
                  <td className="p-3 text-right tabular-nums text-sm font-medium">
                    {rupee(p.amount)}
                  </td>
                  <td className="p-3 text-sm capitalize">{p.method.replace("_", " ")}</td>
                  <td className="p-3 font-mono text-xs text-ink-2 truncate max-w-[180px]">{p.reference ?? "—"}</td>
                  <td className="p-3">
                    {p.status === "received" ? (
                      <Badge kind="success" dot>received</Badge>
                    ) : (
                      <Badge kind="danger" dot>refunded</Badge>
                    )}
                    {p.receipt_voucher_no && (
                      <div className="text-[10px] text-ink-3 font-mono mt-0.5">{p.receipt_voucher_no}</div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {p.status === "received" && me ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="file"
                        onClick={() => setReceiptPayment(p)}
                        title="GST-compliant receipt voucher"
                      >
                        View
                      </Button>
                    ) : (
                      <span className="text-[11px] text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-paper-2">
                <td className="p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Total received</td>
                <td className="p-3 text-right font-serif text-lg tabular-nums text-emerald">{rupee(totalReceivedSoFar)}</td>
                <td colSpan={4} className="p-3 text-xs text-ink-3">
                  {totalReceivedSoFar >= total ? (
                    <span className="text-emerald">✓ Fully paid</span>
                  ) : (
                    <>Remaining <b className="text-amber-ink">{rupee(total - totalReceivedSoFar)}</b></>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* Receipt Voucher dialog — opens for any "received" payment */}
      {me && receiptPayment && (
        <ReceiptVoucherDialog
          open={!!receiptPayment}
          onOpenChange={(open) => !open && setReceiptPayment(null)}
          payment={receiptPayment}
          customerName={customer?.name ?? quote.customer_name}
          customerGstin={customer?.gstin}
          customerEmail={customer?.contact_email}
          tenantName={me.tenantName}
          tenantGstin={me.tenantGstin}
          tenantEmail={me.tenantEmail}
          tenantPhone={me.tenantPhone}
          tenantAddress={me.tenantAddress}
          tenantState={me.tenantState}
          interState={interState}
          quoteId={quote.id}
        />
      )}

      {/* Activity timeline */}
      <Card title="Activity" sub="Workflow history">
        <ActivityTimeline events={events} />
      </Card>

      {/* Payment dialog */}
      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        quoteId={quote.id}
        customerName={quote.customer_name}
        expectedAmount={total}
        alreadyReceived={totalReceivedSoFar}
        isProspect={!!quote.lead_id && !quote.customer_id}
        invoiceId={quote.invoice_id}
        customerId={quote.customer_id}
      />

      {/* Customer-facing quote preview */}
      <QuotePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        tenantName={me?.tenantName    ?? "Workspace"}
        tenantGstin={me?.tenantGstin}
        tenantEmail={me?.tenantEmail}
        tenantPhone={me?.tenantPhone}
        tenantAddress={me?.tenantAddress}
        quoteId={quote.id}
        customerName={quote.customer_name}
        contactName={null}
        contactEmail={null}
        contactPhone={null}
        lineItems={items}
        subtotal={quote.subtotal}
        discountPct={quote.discount_pct}
        discount={discount}
        taxable={taxable}
        taxRate={quote.tax_rate}
        tax={tax}
        total={total}
        interState={interState}
        validityDays={
          quote.expires_date
            ? Math.max(1, daysBetween(new Date(quote.created_at), quote.expires_date))
            : 30
        }
        notes={quote.notes ?? ""}
        isProspect={!!quote.lead_id}
      />

      {/* Send-via-email dialog — replaces legacy mailto: handler */}
      <SendQuoteDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        quoteId={quote.id}
        customerName={quote.customer_name}
        defaultRecipient={customer?.contact_email ?? null}
        alreadySent={quote.status === "sent" || quote.status === "viewed"}
      />

      {/* Send-via-WhatsApp dialog — pre-fills the customer's contact phone
          (or leaves blank for lead-mode quotes — user can type it in)
          and a templated opening line with the quote ID + accept link.
          attachQuoteId enables a PDF-attach checkbox in the dialog so the
          customer receives the actual quote PDF in WhatsApp, not just a
          link. */}
      {whatsOpen && (
        <SendWhatsAppDialog
          open={whatsOpen}
          onOpenChange={setWhatsOpen}
          defaultTo={customer?.contact_phone ?? ""}
          defaultText={
            `Hi ${quote.customer_name},\n\n` +
            `Your quote ${quote.id} for ${rupee(quote.amount)} is attached. ` +
            `You can also review and accept it online:\n` +
            `${typeof window !== "undefined" ? window.location.origin : ""}/quote/${quote.id}/accept\n\n` +
            `— ${me?.tenantName ?? "Excel Technologies"}`
          }
          title={`Send quote ${quote.id} via WhatsApp`}
          attachQuoteId={quote.id}
          attachQuoteLabel={`Quote-${quote.id}.pdf`}
          // Preview the PDF in a new tab — uses the SAME renderer as
          // Download PDF + the server-side WhatsApp send path, so what
          // Pardeep reviews is exactly what the customer will receive.
          onPreviewAttachment={async () => {
            const { previewQuotePDF } = await import("@/lib/pdf");
            await previewQuotePDF({
              tenantName:    me?.tenantName    ?? "Workspace",
              tenantGstin:   me?.tenantGstin,
              tenantEmail:   me?.tenantEmail,
              tenantPhone:   me?.tenantPhone,
              tenantAddress: me?.tenantAddress,
              quoteId:       quote.id,
              customerName:  quote.customer_name,
              contactName:   customer?.contact_name ?? null,
              contactEmail:  customer?.contact_email ?? null,
              contactPhone:  customer?.contact_phone ?? null,
              createdDate:   quote.created_at,
              expiresDate:   quote.expires_date,
              validityDays:  quote.expires_date
                ? Math.max(1, daysBetween(new Date(quote.created_at), quote.expires_date))
                : 30,
              lineItems:     items,
              subtotal:      quote.subtotal,
              discountPct:   quote.discount_pct,
              discount,
              taxable,
              taxRate:       quote.tax_rate,
              tax,
              total,
              interState,
              notes:         quote.notes ?? "",
              isRenewal:     quote.is_renewal,
            });
          }}
          related={{
            quoteId:    quote.id,
            customerId: quote.customer_id ?? undefined,
            leadId:     quote.lead_id ?? undefined,
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Row helper
// ============================================================
function Row({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-ink-3">{label}</span>
      <span className={cn(
        "tabular-nums",
        tone === "emerald" && "text-emerald",
        tone === "rose" && "text-rose"
      )}>{value}</span>
    </div>
  );
}
