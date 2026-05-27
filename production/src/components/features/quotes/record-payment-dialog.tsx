/**
 * RecordPaymentDialog — log a received payment against a quote.
 *
 * Triggered from quote detail when payment_status = 'awaiting'.
 * Marks payment_status = 'received', stores method + reference + amount.
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import { rupee } from "@/lib/utils";
import { fiscalYearFromDate, TDS_SECTIONS } from "@/lib/queries/tds-receivable";

const METHODS = [
  { value: "upi",           label: "UPI (Google Pay / PhonePe / Paytm)" },
  { value: "razorpay",      label: "Razorpay (online)" },
  { value: "bank_transfer", label: "Bank transfer (NEFT/RTGS/IMPS)" },
  { value: "cheque",        label: "Cheque" },
  { value: "cash",          label: "Cash" },
  { value: "other",         label: "Other" },
] as const;

const schema = z.object({
  amount:       z.coerce.number().int().min(1, "Amount received required"),
  method:       z.string().min(1, "Method required"),
  reference:    z.string().min(1, "Transaction reference required"),
  notes:        z.string().optional(),
  // TDS fields — only validated when tdsDeducted is true (handled in submit)
  tdsDeducted:  z.boolean().optional(),
  tdsSection:   z.string().optional(),
  tdsRatePct:   z.coerce.number().min(0).max(100).optional(),
  customerTan:  z.string().optional(),
});

type FormData = z.infer<typeof schema>;

/** Compute TDS amount = pre-GST gross × rate%. */
function computeTds(quoteAmountInclGst: number, ratePct: number): { preGST: number; tds: number } {
  // GST is 18% built into the invoice amount → pre-GST = amount × 100/118
  const preGST = Math.round(quoteAmountInclGst * 100 / 118);
  const tds    = Math.round(preGST * ratePct / 100);
  return { preGST, tds };
}

/** TDS ID generator — keeps it short + globally unique-ish without RPC round-trip. */
function newTdsId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand  = Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `TDS-${stamp}-${rand}`;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  customerName: string;
  expectedAmount: number;
  /** Sum already received in prior payments (₹). Defaults to 0 for first payment. */
  alreadyReceived?: number;
  /** When true, this is a prospect quote — a customer record will be auto-created on full payment */
  isProspect?: boolean;
  /** Invoice ID already issued against this quote (if any) — drives correct footer messaging
   *  and signals "no new RV needed" since this payment is post-invoice. */
  invoiceId?: string | null;
  /** Customer FK — used to fetch saved TAN + default TDS section/rate so the TDS section
   *  pre-fills correctly. Null for prospect quotes (no customer row yet). */
  customerId?: string | null;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  quoteId,
  customerName,
  expectedAmount,
  alreadyReceived = 0,
  isProspect = false,
  invoiceId = null,
  customerId = null,
}: RecordPaymentDialogProps) {
  const qc = useQueryClient();
  const [method, setMethod] = React.useState("upi");

  const remaining = Math.max(0, expectedAmount - alreadyReceived);
  const hasPriorPayments = alreadyReceived > 0;

  // Fetched once when dialog opens — pre-fills TDS section + rate + TAN
  const [customerTdsDefaults, setCustomerTdsDefaults] = React.useState<{
    tan: string | null;
    section: string;
    ratePct: number;
  }>({ tan: null, section: "194J", ratePct: 10 });

  React.useEffect(() => {
    if (!open || !customerId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("tan, tds_default_section, tds_default_rate_pct")
        .eq("id", customerId)
        .maybeSingle();
      if (data) {
        setCustomerTdsDefaults({
          tan:     data.tan ?? null,
          section: data.tds_default_section ?? "194J",
          ratePct: Number(data.tds_default_rate_pct ?? 10),
        });
      }
    })();
  }, [open, customerId]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount:      remaining,
      method:      "upi",
      tdsDeducted: false,
      tdsSection:  "194J",
      tdsRatePct:  10,
      customerTan: "",
    },
  });

  const watchedAmount = watch("amount") || 0;
  const tdsDeducted   = watch("tdsDeducted") || false;
  const tdsRatePct    = Number(watch("tdsRatePct") || 0);

  // TDS computation — preGST × rate%
  const { preGST: quotePreGST, tds: tdsAmount } = React.useMemo(
    () => tdsDeducted ? computeTds(expectedAmount, tdsRatePct) : { preGST: 0, tds: 0 },
    [tdsDeducted, tdsRatePct, expectedAmount],
  );

  // When TDS is checked, "amount received" represents the BANK amount
  // (post-TDS). The amount we record_payment with is amount + TDS (since
  // the TDS portion was settled to govt against the reseller's PAN).
  const settledAgainstQuote  = tdsDeducted ? (watchedAmount + tdsAmount) : watchedAmount;
  const newRunningTotal      = alreadyReceived + settledAgainstQuote;
  const willBePartial        = newRunningTotal < expectedAmount && newRunningTotal > 0;
  const willBeOverpaid       = newRunningTotal > expectedAmount;

  React.useEffect(() => {
    if (!open) {
      reset();
      setMethod("upi");
    } else {
      reset({
        amount:      remaining,
        method:      "upi",
        tdsDeducted: false,
        tdsSection:  customerTdsDefaults.section,
        tdsRatePct:  customerTdsDefaults.ratePct,
        customerTan: customerTdsDefaults.tan ?? "",
      });
    }
  }, [open, reset, remaining, customerTdsDefaults]);

  // Auto-reduce amount when TDS gets toggled ON — user typed full quote,
  // but with TDS, bank gets quote − TDS.
  React.useEffect(() => {
    if (tdsDeducted && watchedAmount === remaining && remaining === expectedAmount) {
      // First-payment full-amount case → drop bank amount by TDS
      setValue("amount", Math.max(0, remaining - tdsAmount));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdsDeducted]);

  const recordPayment = useMutation({
    mutationFn: async (data: FormData) => {
      const supabase = createClient();

      // ── 1. Determine settlement amount ────────────────────────────
      // When TDS deducted, the quote is satisfied for (bank_received + tds_amount)
      // because the TDS portion is already deposited with govt against the
      // reseller's PAN — it's a receivable from govt, not from the customer.
      const tdsActive = !!data.tdsDeducted;
      const settledAmount = tdsActive
        ? data.amount + tdsAmount
        : data.amount;

      // ── 2. Single atomic RPC — replaces 7-9 chained client mutations.
      const { data: r, error } = await supabase.rpc("record_payment", {
        p_quote_id:  quoteId,
        p_amount:    settledAmount,
        p_method:    data.method as "upi" | "razorpay" | "bank_transfer" | "cheque" | "cash" | "other",
        p_reference: data.reference,
        p_notes:     [
          data.notes || null,
          tdsActive
            ? `TDS ${data.tdsSection} @ ${tdsRatePct}% = ₹${tdsAmount.toLocaleString("en-IN")} on pre-GST ₹${quotePreGST.toLocaleString("en-IN")}`
            : null,
        ].filter(Boolean).join(" · ") || null,
      });
      if (error) throw error;
      if (!r) throw new Error("record_payment returned no result");

      // ── 3. Insert TDS receivable row (best-effort; failure is non-fatal)
      if (tdsActive && tdsAmount > 0) {
        // Get tenant_id via current user
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: me } = await supabase
            .from("users")
            .select("tenant_id")
            .eq("id", authData.user.id)
            .maybeSingle();
          if (me) {
            const today  = new Date().toISOString().slice(0, 10);
            const tdsErr = (await supabase.from("tds_receivable").insert({
              id:                    newTdsId(),
              tenant_id:             me.tenant_id,
              invoice_id:            invoiceId ?? null,
              payment_id:            r.payment_id,
              customer_id:           customerId ?? null,
              customer_name:         customerName,
              customer_tan:          data.customerTan?.trim() || null,
              section:               data.tdsSection ?? "194J",
              rate_pct:              tdsRatePct,
              gross_amount:          quotePreGST,
              tds_amount:            tdsAmount,
              net_paid:              data.amount,
              fiscal_year:           fiscalYearFromDate(today),
              payment_received_date: today,
              status:                "pending_cert",
              notes:                 `Auto-created from payment ${r.payment_id} on quote ${quoteId}`,
            })).error;
            if (tdsErr) {
              // Don't fail the whole payment — just warn. Pardeep can add TDS row manually.
              console.error("[record-payment] TDS row insert failed (payment still recorded):", tdsErr);
            }

            // Auto-save customer's TAN + TDS defaults for next time
            if (customerId && data.customerTan?.trim()) {
              await supabase
                .from("customers")
                .update({
                  tan:                  data.customerTan.trim(),
                  tds_default_section:  data.tdsSection ?? "194J",
                  tds_default_rate_pct: tdsRatePct,
                })
                .eq("id", customerId);
            }
          }
        }
      }

      // Re-shape into the camelCase keys the onSuccess handler already consumes
      return {
        newPaymentId:           r.payment_id,
        totalReceived:          r.total_received,
        expected:               r.expected,
        outstanding:            r.outstanding,
        isFirstPayment:         r.is_first_payment,
        isFullyPaid:            r.is_fully_paid,
        convertedNow:           r.converted_now,
        subscriptionCreated:    r.subscription_created,
        invoicePaid:            r.invoice_paid,
        hasExistingInvoice:     r.has_existing_invoice,
        // Renewal roll-forward — added in migration 0010
        isRenewalQuote:         r.is_renewal_quote ?? false,
        renewalRolledForward:   r.renewal_rolled_forward ?? false,
        // TDS — added in TDS Phase 2
        tdsRecorded:            tdsActive,
        tdsAmount:              tdsActive ? tdsAmount : 0,
      };
    },
    onSuccess: (res) => {
      // Invalidate everything that this touches
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", quoteId] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payments", "by-quote", quoteId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["contacts", "all"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["outstanding-receivables"] });
      qc.invalidateQueries({ queryKey: ["nav-badges"] });
      qc.invalidateQueries({ queryKey: ["tds_receivable"] });

      if (res.renewalRolledForward) {
        // Renewal quote fully paid — subscription rolled forward 1 year
        toast.success("Renewal payment received · subscription rolled forward 1 year 🎉", { duration: 6000 });
        setTimeout(() => toast.info("Reminder cadence reset · next cycle starts T-15 of new renewal date", { duration: 6000 }), 800);
      } else if (res.isRenewalQuote && !res.isFullyPaid) {
        // Partial payment against a renewal quote — sub NOT rolled forward yet
        toast.success(`Partial renewal payment recorded · ₹${res.outstanding.toLocaleString("en-IN")} still due to renew`, { duration: 6000 });
      } else if (res.convertedNow) {
        // First payment on prospect — service starts, customer created
        if (res.isFullyPaid) {
          toast.success("Paid in full · Customer + subscription activated 🎉", { duration: 5000 });
        } else {
          toast.success(`Advance received · Customer + subscription activated`, { duration: 5000 });
          setTimeout(() => toast.info(`₹${res.outstanding.toLocaleString("en-IN")} outstanding — service active, balance pending`, { duration: 6000 }), 600);
        }
        if (res.subscriptionCreated) {
          setTimeout(() => toast.success("Subscription created · renewal in 1 year", { duration: 5000 }), 1200);
        }
      } else if (res.invoicePaid) {
        // Post-invoice balance payment that fully cleared the invoice
        toast.success("Balance received · invoice marked paid 🎉", { duration: 5000 });
      } else if (res.hasExistingInvoice) {
        // Post-invoice payment but invoice still has balance
        toast.success(
          `Payment recorded against invoice · ₹${res.outstanding.toLocaleString("en-IN")} still pending`,
          { duration: 5000 },
        );
      } else if (res.isFullyPaid) {
        toast.success("Final payment received · invoice can now be generated", { duration: 5000 });
      } else {
        toast.success(
          `Payment recorded · ₹${res.outstanding.toLocaleString("en-IN")} still pending`,
          { duration: 5000 },
        );
      }
      // TDS receivable acknowledgement — fires as a second toast so it's
      // visible without overshadowing the primary payment confirmation.
      if (res.tdsRecorded && res.tdsAmount > 0) {
        setTimeout(() => {
          toast.info(
            `TDS receivable ₹${res.tdsAmount.toLocaleString("en-IN")} logged · chase Form 16A from ${customerName}`,
            { duration: 6000 },
          );
        }, 700);
      }
      onOpenChange(false);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {hasPriorPayments ? "Record additional payment" : "Record payment received"}
          </DialogTitle>
          <DialogDescription>
            Log a payment against quote <span className="font-mono font-semibold">{quoteId}</span> from <b>{customerName}</b>.
            {hasPriorPayments
              ? " Multiple payments are supported (installments / partial)."
              : " You can record more payments later if it's paid in installments."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => recordPayment.mutate(data))} className="space-y-4">
          {/* Prospect → Customer activation notice — fires on FIRST payment now (advance ok) */}
          {isProspect && !hasPriorPayments && (
            <div className="rounded-md bg-amber-soft border border-amber/40 px-3 py-2.5 text-xs flex items-start gap-2">
              <Icon name="info" size={14} className="text-amber-ink flex-shrink-0 mt-0.5" />
              <div className="text-amber-ink">
                <b>First payment — service activation.</b> Confirming will automatically:
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Create a Customer record for <b>{customerName}</b></li>
                  <li>Move the lead to <b>Won</b></li>
                  <li>Start the 1-year subscription with today's date</li>
                  <li>Track any outstanding balance separately</li>
                </ul>
                {newRunningTotal < expectedAmount && (
                  <p className="mt-1.5">
                    <b>Service activates with ₹{(expectedAmount - newRunningTotal).toLocaleString("en-IN")} outstanding</b> —
                    you'll continue to see this in the subscription card until paid.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Payment summary — already paid + this payment + remaining */}
          <div className="bg-paper-2 rounded-md p-3 text-sm space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-ink-3">Quote total</span>
              <span className="font-medium tabular-nums">{rupee(expectedAmount)}</span>
            </div>
            {hasPriorPayments && (
              <div className="flex justify-between items-baseline">
                <span className="text-ink-3">Already received</span>
                <span className="tabular-nums text-emerald">−{rupee(alreadyReceived)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-hairline">
              <span className="text-ink-3">{hasPriorPayments ? "Remaining" : "Expected this payment"}</span>
              <span className="font-serif text-lg tabular-nums text-amber-ink">{rupee(remaining)}</span>
            </div>
          </div>

          {/* Warning for over-payment */}
          {willBeOverpaid && (
            <div className="rounded-md bg-rose-soft border border-rose/30 px-3 py-2 text-xs text-rose flex items-start gap-2">
              <Icon name="alert" size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                Amount exceeds remaining ({rupee(remaining)}). You're recording an excess payment —
                refund or adjust if this is a mistake.
              </span>
            </div>
          )}

          {/* Partial-payment status preview */}
          {willBePartial && (
            <div className="rounded-md bg-indigo-50 border border-indigo/30 px-3 py-2 text-xs text-indigo flex items-start gap-2">
              <Icon name="info" size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                This payment of <b>{rupee(watchedAmount)}</b> brings total received to <b>{rupee(newRunningTotal)}</b>.
                Quote will remain <b>partial</b> ({rupee(expectedAmount - newRunningTotal)} pending).
              </span>
            </div>
          )}

          <FormField label={tdsDeducted ? "Amount received in bank (₹)" : "Amount received (₹)"} required htmlFor="amount">
            <Input
              id="amount"
              type="number"
              min={1}
              prefix="₹"
              error={errors.amount?.message}
              helper={
                tdsDeducted
                  ? `Net cash to your bank (after customer's TDS deduction). System will settle the full ₹${(watchedAmount + tdsAmount).toLocaleString("en-IN")} against the quote.`
                  : hasPriorPayments
                    ? `Defaults to remaining ${rupee(remaining)}. Edit if partial.`
                    : `Defaults to full ${rupee(expectedAmount)}. Edit if partial.`
              }
              {...register("amount", { valueAsNumber: true })}
            />
          </FormField>

          <FormField label="Payment method" required htmlFor="method">
            <Select
              value={method}
              onValueChange={(v) => {
                setMethod(v);
                (register("method") as any).onChange({ target: { value: v, name: "method" } });
              }}
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register("method")} value={method} />
          </FormField>

          <FormField label="Transaction reference" required htmlFor="reference">
            <Input
              id="reference"
              placeholder={
                method === "upi" ? "UPI Ref ID (e.g., 4xxxxxxxxxxx)" :
                method === "razorpay" ? "pay_xxxxxxxxxxxxxx" :
                method === "bank_transfer" ? "UTR / Bank reference" :
                method === "cheque" ? "Cheque number" :
                "Reference number"
              }
              error={errors.reference?.message}
              {...register("reference")}
            />
          </FormField>

          {/* ── TDS section ─────────────────────────────────────────
              B2B customers (Pvt Ltd, LLPs, larger firms) deduct TDS
              before paying. Check the box → fields appear → on submit
              the TDS portion is logged as a receivable from govt. */}
          <div className="rounded-md border border-hairline px-3 py-2.5 bg-paper-2/30">
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                {...register("tdsDeducted")}
              />
              <div className="flex-1">
                <div className="font-medium text-ink">Customer deducted TDS</div>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  Tick this when a B2B customer paid you LESS than the quote total
                  because they withheld TDS (typically 10% u/s 194J).
                </div>
              </div>
            </label>

            {tdsDeducted && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Section" required htmlFor="tdsSection">
                    <Select
                      value={watch("tdsSection") ?? "194J"}
                      onValueChange={(v) => setValue("tdsSection", v)}
                    >
                      <SelectTrigger id="tdsSection">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TDS_SECTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Rate (%)" required htmlFor="tdsRatePct">
                    <Input
                      id="tdsRatePct"
                      type="number"
                      step={0.01}
                      min={0}
                      max={100}
                      {...register("tdsRatePct", { valueAsNumber: true })}
                    />
                  </FormField>
                </div>

                <FormField label="Customer TAN" htmlFor="customerTan">
                  <Input
                    id="customerTan"
                    placeholder="MUMS12345A (Tax Account Number)"
                    {...register("customerTan")}
                  />
                  <p className="text-[10px] text-ink-3 mt-1">
                    10-character TAN of the customer (different from GSTIN). Required to verify Form 26AS deposit.
                    Saved to customer profile for future invoices.
                  </p>
                </FormField>

                {/* Live computation breakdown */}
                <div className="bg-paper rounded-md p-3 text-xs space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">
                    TDS computation
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">Quote total (incl 18% GST)</span>
                    <span className="font-mono">{rupee(expectedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">Pre-GST taxable value</span>
                    <span className="font-mono">{rupee(quotePreGST)}</span>
                  </div>
                  <div className="flex justify-between text-rose">
                    <span>TDS @ {tdsRatePct}% (deposited to govt)</span>
                    <span className="font-mono">−{rupee(tdsAmount)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-hairline">
                    <span className="text-ink-3">Net to your bank</span>
                    <span className="font-mono font-semibold text-emerald">{rupee(expectedAmount - tdsAmount)}</span>
                  </div>
                  <div className="text-[10px] text-ink-3 mt-2 leading-relaxed">
                    Adjust &quot;Amount received&quot; above to match what actually hit your bank.
                    The quote will be marked fully satisfied — ₹{tdsAmount.toLocaleString("en-IN")} TDS appears as a receivable in <a href="/accounting/tds-receivable" className="underline">/accounting/tds-receivable</a>.
                  </div>
                </div>
              </div>
            )}
          </div>

          <FormField label="Notes (optional)" htmlFor="notes">
            <Textarea
              id="notes"
              placeholder="Any additional details about this payment…"
              rows={2}
              {...register("notes")}
            />
          </FormField>

          {newRunningTotal >= expectedAmount && (
            <div className="bg-emerald-soft border border-emerald/20 rounded-md p-3 text-xs text-emerald flex gap-2 items-start">
              <Icon name="info" size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                {invoiceId ? (
                  <>
                    Invoice <b className="font-mono">{invoiceId}</b> will be marked <b>paid</b>. No new receipt voucher — post-invoice payment.
                  </>
                ) : (
                  <>
                    Quote will be marked <b>fully paid</b>. You can then generate the GST invoice from the quote detail page.
                  </>
                )}
              </span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting || recordPayment.isPending}
              icon="check"
            >
              Confirm payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
