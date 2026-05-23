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

const METHODS = [
  { value: "upi",           label: "UPI (Google Pay / PhonePe / Paytm)" },
  { value: "razorpay",      label: "Razorpay (online)" },
  { value: "bank_transfer", label: "Bank transfer (NEFT/RTGS/IMPS)" },
  { value: "cheque",        label: "Cheque" },
  { value: "cash",          label: "Cash" },
  { value: "other",         label: "Other" },
] as const;

const schema = z.object({
  amount:    z.coerce.number().int().min(1, "Amount required"),
  method:    z.string().min(1, "Method required"),
  reference: z.string().min(1, "Transaction reference required"),
  notes:     z.string().optional(),
});

type FormData = z.infer<typeof schema>;

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
}: RecordPaymentDialogProps) {
  const qc = useQueryClient();
  const [method, setMethod] = React.useState("upi");

  const remaining = Math.max(0, expectedAmount - alreadyReceived);
  const hasPriorPayments = alreadyReceived > 0;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: remaining,
      method: "upi",
    },
  });

  const watchedAmount = watch("amount") || 0;
  const newRunningTotal = alreadyReceived + watchedAmount;
  const willBePartial = newRunningTotal < expectedAmount && newRunningTotal > 0;
  const willBeOverpaid = newRunningTotal > expectedAmount;

  React.useEffect(() => {
    if (!open) {
      reset();
      setMethod("upi");
    } else {
      reset({ amount: remaining, method: "upi" });
    }
  }, [open, reset, remaining]);

  const recordPayment = useMutation({
    mutationFn: async (data: FormData) => {
      const supabase = createClient();

      // Single atomic RPC — replaces 7-9 chained client mutations.
      // See supabase/migrations/0006_record_payment_rpc.sql for the
      // transactional contract: lead→customer, lead promotion, RV# issue,
      // payment insert, subscription create, quote update, invoice paid-check
      // all happen in one Postgres transaction (or none of them do).
      const { data: r, error } = await supabase.rpc("record_payment", {
        p_quote_id:  quoteId,
        p_amount:    data.amount,
        p_method:    data.method as "upi" | "razorpay" | "bank_transfer" | "cheque" | "cash" | "other",
        p_reference: data.reference,
        p_notes:     data.notes || null,
      });
      if (error) throw error;
      if (!r) throw new Error("record_payment returned no result");

      // Re-shape into the camelCase keys the onSuccess handler already consumes
      return {
        newPaymentId:        r.payment_id,
        totalReceived:       r.total_received,
        expected:            r.expected,
        outstanding:         r.outstanding,
        isFirstPayment:      r.is_first_payment,
        isFullyPaid:         r.is_fully_paid,
        convertedNow:        r.converted_now,
        subscriptionCreated: r.subscription_created,
        invoicePaid:         r.invoice_paid,
        hasExistingInvoice:  r.has_existing_invoice,
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

      if (res.convertedNow) {
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

          <FormField label="Amount received (₹)" required htmlFor="amount">
            <Input
              id="amount"
              type="number"
              min={1}
              prefix="₹"
              error={errors.amount?.message}
              helper={
                hasPriorPayments
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
