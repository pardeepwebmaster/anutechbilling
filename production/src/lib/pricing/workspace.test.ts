import { describe, it, expect } from "vitest";
import {
  buildWorkspaceLines,
  resolveMonthlyMsrp,
  TIER_FALLBACK_MONTHLY,
  type CatalogPriceRow,
} from "./workspace";

// A catalog row shaped like the real `items` rows for the buy-page tenant.
const standardRow: CatalogPriceRow = {
  id: "gw-std", name: "Google Workspace Standard",
  msrp: 736, wholesale: 620,
  prices: { annual: { msrp: 736, wholesale: 620 } },
};

describe("buildWorkspaceLines — catalog is the single source of truth", () => {
  it("prices Standard from the catalog (₹736/user/mo retail)", () => {
    const r = buildWorkspaceLines(standardRow, "standard", 10);
    expect(r.monthlyMsrp).toBe(736);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].rate).toBe(736 * 12);        // ₹8,832/seat/year
    expect(r.subtotal).toBe(736 * 12 * 10);        // ₹88,320 ex-GST
    expect(r.amount).toBe(Math.round(88320 * 1.18)); // ₹1,04,218 incl 18% GST
  });

  it("PARITY: catalog-miss fallback equals the catalog price (no more buy-vs-quote divergence)", () => {
    // The bug (#10): enquiry hardcoded ₹1080 while checkout used catalog ₹736.
    // Now the fallback matches the catalog, so a missing row prices identically.
    const fromCatalog = buildWorkspaceLines(standardRow, "standard", 25);
    const fromFallback = buildWorkspaceLines(null, "standard", 25);
    expect(fromFallback.monthlyMsrp).toBe(TIER_FALLBACK_MONTHLY.standard); // 736
    expect(fromFallback.amount).toBe(fromCatalog.amount);
  });

  it("applies NO first-20-seats promo — flat per-seat (promos go via coupons)", () => {
    const r = buildWorkspaceLines(standardRow, "standard", 30);
    // Flat: every seat at ₹736/mo. The old enquiry split first-20 at a promo rate.
    expect(r.subtotal).toBe(736 * 12 * 30);
    expect(r.items).toHaveLength(1);
  });

  it("falls back per tier when no catalog row (starter ₹136, enterprise ₹2400)", () => {
    expect(resolveMonthlyMsrp(null, "starter")).toBe(136);
    expect(resolveMonthlyMsrp(null, "enterprise")).toBe(2400);
    const starter = buildWorkspaceLines(null, "starter", 5);
    expect(starter.subtotal).toBe(136 * 12 * 5);
  });

  it("produces no line items when nothing can price the tier", () => {
    const r = buildWorkspaceLines({ ...standardRow, msrp: 0, prices: null }, "unknown-tier", 10);
    expect(r.items).toHaveLength(0);
    expect(r.amount).toBe(0);
  });

  it("prefers prices.annual.msrp over the legacy msrp column", () => {
    const row: CatalogPriceRow = {
      id: "x", name: "Google Workspace Standard", msrp: 999,
      wholesale: 620, prices: { annual: { msrp: 736, wholesale: 620 } },
    };
    expect(resolveMonthlyMsrp(row, "standard")).toBe(736);
  });
});
