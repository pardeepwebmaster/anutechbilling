"use client";

/**
 * PayInvoiceButton — "Pay now" on an outstanding invoice in the portal.
 * Posts to /api/portal/invoice/[id]/pay. In simulation mode the payment is
 * recorded server-side immediately; in live mode we open the Razorpay widget
 * and the webhook records the payment on capture.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadRazorpayCheckout } from "@/lib/razorpay/checkout-client";

interface PayResponse {
  success?: boolean;
  error?: string;
  simulated?: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  razorpayKeyId?: string;
  invoiceId?: string;
  customerName?: string;
}

export function PayInvoiceButton({
  invoiceId,
  email,
}: {
  invoiceId: string;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onPay() {
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/invoice/${encodeURIComponent(invoiceId)}/pay`, {
        method: "POST",
      });
      const data = (await res.json()) as PayResponse;
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Couldn't start payment.");
        return;
      }

      // Simulation — payment already recorded server-side.
      if (data.simulated) {
        toast.success("Payment recorded. Thank you!");
        router.refresh();
        return;
      }

      // Live — open the Razorpay widget.
      if (data.orderId && data.razorpayKeyId) {
        const Razorpay = await loadRazorpayCheckout();
        const rzp = new Razorpay({
          key: data.razorpayKeyId,
          amount: data.amount ?? 0,
          currency: data.currency ?? "INR",
          name: data.customerName || "Pay invoice",
          description: `Invoice ${invoiceId}`,
          order_id: data.orderId,
          prefill: { email },
          theme: { color: "#C2410C" },
          handler: () => {
            toast.success("Payment received! Your invoice will update shortly.");
            // Webhook flips the invoice paid; refresh after a short beat.
            setTimeout(() => router.refresh(), 2500);
          },
          modal: { ondismiss: () => setBusy(false) },
        });
        rzp.on("payment.failed", (resp) => {
          toast.error(resp.error?.description ?? "Payment failed. Please try again.");
        });
        rzp.open();
        return;
      }

      toast.error("Payment could not be started. Please contact your reseller.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="primary" loading={busy} onClick={onPay}>
      Pay now
    </Button>
  );
}
