import { describe, it, expect } from "vitest";
import { foreignEquivalent, formatForeign, isForeignCurrency } from "./currency";

describe("foreignEquivalent", () => {
  it("₹83,000 at ₹83/USD → $1,000", () => {
    expect(foreignEquivalent(83000, 83)).toBe(1000);
  });
  it("guards against a zero / missing rate (no divide-by-zero)", () => {
    expect(foreignEquivalent(83000, 0)).toBe(0);
    expect(foreignEquivalent(83000, -1)).toBe(0);
  });
});

describe("formatForeign", () => {
  it("adds the symbol + 2 decimals", () => {
    expect(formatForeign(1000, "USD")).toBe("$1,000.00");
    expect(formatForeign(1234.5, "EUR")).toBe("€1,234.50");
  });
  it("falls back to the code for unknown currencies", () => {
    expect(formatForeign(500, "JPY")).toBe("JPY 500.00");
  });
});

describe("isForeignCurrency", () => {
  it("INR / blank / null → domestic", () => {
    expect(isForeignCurrency("INR")).toBe(false);
    expect(isForeignCurrency("inr")).toBe(false);
    expect(isForeignCurrency("")).toBe(false);
    expect(isForeignCurrency(null)).toBe(false);
    expect(isForeignCurrency(undefined)).toBe(false);
  });
  it("real currencies → foreign", () => {
    expect(isForeignCurrency("USD")).toBe(true);
    expect(isForeignCurrency("EUR")).toBe(true);
  });
});
