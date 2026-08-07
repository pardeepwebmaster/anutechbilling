import { describe, it, expect } from "vitest";
import { sanitizeExtractedBill, normaliseCurrency } from "./sanitize";

describe("normaliseCurrency", () => {
  it("defaults to INR when empty/unknown", () => {
    expect(normaliseCurrency(null)).toBe("INR");
    expect(normaliseCurrency("")).toBe("INR");
    expect(normaliseCurrency("something")).toBe("INR");
  });
  it("recognises rupee + dollar spellings and symbols", () => {
    expect(normaliseCurrency("₹")).toBe("INR");
    expect(normaliseCurrency("Rs.")).toBe("INR");
    expect(normaliseCurrency("$")).toBe("USD");
    expect(normaliseCurrency("usd")).toBe("USD");
    expect(normaliseCurrency("EUR")).toBe("EUR");
  });
});

describe("sanitizeExtractedBill — Indian GST bill", () => {
  const out = sanitizeExtractedBill({
    vendor_name: "  Google Cloud India Pvt Ltd ",
    vendor_gstin: "29aabcg1234f1z5",
    bill_no: "GW-INV-99",
    bill_date: "2026-07-01",
    currency: "INR",
    subtotal: 10000,
    cgst: 900,
    sgst: 900,
    igst: 0,
    total: 11800,
    line_items: [
      { description: "Workspace Business Starter", qty: 10, unit_price: 136, amount: 1360 },
      { description: "", qty: null, unit_price: null, amount: 0 }, // junk row → dropped
    ],
    category_guess: "COGS-Workspace",
  });

  it("trims + upper-cases GSTIN, keeps INR amounts", () => {
    expect(out.vendor_name).toBe("Google Cloud India Pvt Ltd");
    expect(out.vendor_gstin).toBe("29AABCG1234F1Z5");
    expect(out.currency).toBe("INR");
    expect(out.subtotal).toBe(10000);
    expect(out.cgst).toBe(900);
    expect(out.total).toBe(11800);
  });

  it("keeps only real line items", () => {
    expect(out.line_items).toHaveLength(1);
    expect(out.line_items[0]).toEqual({ description: "Workspace Business Starter", qty: 10, unit_price: 136, amount: 1360 });
  });
});

describe("sanitizeExtractedBill — foreign USD (OIDAR, e.g. Anthropic)", () => {
  const out = sanitizeExtractedBill({
    vendor_name: "Anthropic, PBC",
    vendor_gstin: "9924USA29003OSI",
    bill_no: "G06GABHR-0015",
    bill_date: "2026-07-25",
    currency: "USD",
    subtotal: 225,
    cgst: 0,
    sgst: 0,
    igst: 40.5, // single "GST - India" line
    total: 265.5,
    line_items: [
      { description: "Team plan - Premium", qty: 1, unit_price: 125, amount: 125 },
      { description: "Team plan - Standard", qty: 4, unit_price: 25, amount: 100 },
    ],
    category_guess: "COGS-Other",
  });

  it("preserves the USD currency + decimal amounts (no forced INR rounding)", () => {
    expect(out.currency).toBe("USD");
    expect(out.igst).toBe(40.5);
    expect(out.total).toBe(265.5);
  });

  it("keeps the foreign OIDAR GSTIN verbatim (upper-cased)", () => {
    expect(out.vendor_gstin).toBe("9924USA29003OSI");
  });

  it("extracts both line items with qty + unit price", () => {
    expect(out.line_items).toHaveLength(2);
    expect(out.line_items[1]).toEqual({ description: "Team plan - Standard", qty: 4, unit_price: 25, amount: 100 });
  });
});

describe("sanitizeExtractedBill — missing / dirty data", () => {
  it("returns nulls + empty line items without throwing", () => {
    const out = sanitizeExtractedBill({});
    expect(out.vendor_name).toBeNull();
    expect(out.subtotal).toBeNull();
    expect(out.cgst).toBe(0);
    expect(out.currency).toBe("INR");
    expect(out.line_items).toEqual([]);
  });
  it("rejects a bad date, keeps a good one", () => {
    expect(sanitizeExtractedBill({ bill_date: "25 July 2026" }).bill_date).toBeNull();
    expect(sanitizeExtractedBill({ bill_date: "2026-07-25" }).bill_date).toBe("2026-07-25");
  });
});
