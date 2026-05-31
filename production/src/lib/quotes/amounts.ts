/**
 * Quote money helpers.
 *
 * grossAmount — the GST-inclusive payable from a taxable (ex-GST) subtotal,
 * using the same rounding the quote builder uses: subtotal + round(subtotal *
 * rate%). This is what the `quotes.amount` column must store (it's what the
 * customer pays and what record_payment treats as "expected").
 *
 * Renewal + extension quotes were storing the EX-GST subtotal in `amount`,
 * so they under-billed the 18% GST on every renewal (₹1,03,680 instead of
 * ₹1,22,342 for a 10-seat Standard renewal). This helper fixes that and keeps
 * renewal/extension consistent with normal quotes.
 */
export function grossAmount(subtotal: number, taxRatePct = 18): number {
  const base = Math.max(0, Math.round(subtotal));
  return base + Math.round((base * taxRatePct) / 100);
}
