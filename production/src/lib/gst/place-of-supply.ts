/**
 * Place-of-supply → GST head (CGST+SGST vs IGST)
 *
 * Single source of truth for deciding whether a supply is intra-state
 * (CGST + SGST split) or inter-state (IGST). Previously this was computed
 * inconsistently across the codebase — correctly in the quote detail page,
 * but hardcoded (`false`, or seller="27") in the quote builder, the quote-send
 * PDF route, and the tax-invoice dialog. That produced the WRONG GST head on
 * tax invoices for inter-state customers (a compliance defect: the total 18%
 * was right, but the head was wrong, which breaks the buyer's ITC). Fixes
 * audit bugs #18/#19/#20.
 *
 * GST rule (IGST Act §7, CGST Act §8): the head is determined by comparing the
 * **place of supply** (the buyer's state) with the **location of the supplier**
 * (the seller's state). Same state → intra-state → CGST + SGST. Different state
 * → inter-state → IGST. The first two digits of a GSTIN are the state code
 * (e.g. 07 = Delhi, 27 = Maharashtra), which is why we compare `state_code`.
 *
 * Conservative default: if EITHER state code is missing we return `false`
 * (intra-state, CGST + SGST). This is the safe default for a same-state sale,
 * but it can be wrong for an inter-state customer when the seller's own
 * `state_code` hasn't been set up yet. Callers should ensure the tenant's GST
 * profile (state_code) is configured — see /setup — so the comparison is real.
 */
export function isInterStateSupply(
  customerStateCode: string | null | undefined,
  sellerStateCode: string | null | undefined,
): boolean {
  return Boolean(
    customerStateCode &&
    sellerStateCode &&
    customerStateCode !== sellerStateCode,
  );
}
