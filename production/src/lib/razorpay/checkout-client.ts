/**
 * Razorpay Checkout JS loader + minimal client types. Shared so both the
 * /buy pages and the customer portal "Pay now" can open the widget without
 * duplicating the script-loading dance.
 */
export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // paise
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler?: (resp: RazorpayCheckoutResponse) => void;
  modal?: { ondismiss?: () => void };
}

export interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (resp: { error: { description?: string } }) => void) => void;
}

export type RazorpayCtor = new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

// Access window.Razorpay via a local cast instead of a global `declare` so we
// don't collide with the buy-page client's own Window augmentation (TS2717).
function getRazorpayGlobal(): RazorpayCtor | undefined {
  return (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
}

/** Lazy-load Razorpay Checkout JS. Resolves when window.Razorpay is ready. */
export function loadRazorpayCheckout(): Promise<RazorpayCtor> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay Checkout requires a browser"));
      return;
    }
    const existingGlobal = getRazorpayGlobal();
    if (existingGlobal) {
      resolve(existingGlobal);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        const g = getRazorpayGlobal();
        if (g) resolve(g);
        else reject(new Error("Razorpay loaded but global is missing"));
      });
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_CHECKOUT_SRC;
    s.async = true;
    s.onload = () => {
      const g = getRazorpayGlobal();
      if (g) resolve(g);
      else reject(new Error("Razorpay loaded but global is missing"));
    };
    s.onerror = () => reject(new Error("Razorpay script failed to load"));
    document.body.appendChild(s);
  });
}
