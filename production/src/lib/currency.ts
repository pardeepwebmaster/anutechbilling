/**
 * Foreign-currency helpers (international / export clients).
 *
 * The books ALWAYS stay in INR — quote.amount, payments, MRR, invoices, P&L are
 * integer ₹. A foreign currency is a CAPTURE + DISPLAY layer: the customer is
 * billed in `currency` at `exchange_rate` (INR per 1 unit), and the foreign
 * figure shown on the quote/invoice is derived from the canonical ₹ amount.
 */

/** Currencies an Indian reseller commonly bills international clients in. */
export const BILLING_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"] as const;
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];

const SYMBOL: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$", AUD: "A$", CAD: "C$",
};

/** The foreign-currency equivalent of an INR amount at the given rate (INR per unit). */
export function foreignEquivalent(inrAmount: number, exchangeRate: number): number {
  if (!exchangeRate || exchangeRate <= 0) return 0;
  return inrAmount / exchangeRate;
}

/**
 * Format a foreign amount with its symbol + 2 decimals.
 *   formatForeign(1000, "USD") → "$1,000.00"
 *   formatForeign(1234.5, "EUR") → "€1,234.50"
 */
export function formatForeign(amount: number, currency: string, decimals: number = 2): string {
  const sym = SYMBOL[currency] ?? `${currency} `;
  return sym + amount.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** True when a currency is a real foreign currency (not INR / blank). */
export function isForeignCurrency(currency: string | null | undefined): boolean {
  const c = (currency ?? "INR").trim().toUpperCase();
  return c !== "" && c !== "INR";
}
