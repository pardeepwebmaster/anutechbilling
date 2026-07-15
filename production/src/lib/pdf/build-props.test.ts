import { describe, it, expect } from "vitest";
import { quoteAmounts, buildInvoicePdfProps, buildQuotePdfProps, type TenantPdfInfo } from "./build-props";
import type { Invoice, Quote, Customer } from "@/lib/supabase/database.types";

const tenant: TenantPdfInfo = {
  name: "Anutech", gstin: "27AABCE1234D1Z9", email: "a@x.in", phone: "+91",
  address: "Mumbai", state: "Maharashtra", state_code: "27",
};

describe("quoteAmounts", () => {
  it("computes discount/taxable/tax with the app's rounding", () => {
    const a = quoteAmounts({ subtotal: 100000, discount_pct: 10, tax_rate: 18, amount: 132840 });
    expect(a.discount).toBe(10000);   // round(100000 * 10%)
    expect(a.taxable).toBe(90000);    // 100000 - 10000
    expect(a.tax).toBe(16200);        // round(90000 * 18%)
    expect(a.total).toBe(132840);     // authoritative quote.amount
  });
  it("falls back total to taxable+tax when amount is null", () => {
    const a = quoteAmounts({ subtotal: 1000, discount_pct: 0, tax_rate: 18, amount: null });
    expect(a.total).toBe(1180);
  });
});

describe("buildInvoicePdfProps", () => {
  const invoice = { id: "INV-1", amount: 38232, customer_name: "Acme", tenant_id: "t1" } as Invoice;
  const quote = { subtotal: 32400, discount_pct: 0, tax_rate: 18, amount: 38232, line_items: [] } as unknown as Quote;

  it("uses quote.amount as total and derives the breakdown", () => {
    const p = buildInvoicePdfProps({ invoice, quote, customer: null, tenant });
    expect(p.total).toBe(38232);
    expect(p.subtotal).toBe(32400);
    expect(p.tax).toBe(5832);
    expect(p.interState).toBe(false); // no customer state → intra-state default
  });

  it("marks inter-state when customer state differs from tenant", () => {
    const customer = { state_code: "07", gstin: null, contact_email: null, address: null, state: "Delhi" } as unknown as Customer;
    expect(buildInvoicePdfProps({ invoice, quote, customer, tenant }).interState).toBe(true);
  });

  it("falls back to invoice.amount when there is no quote", () => {
    const p = buildInvoicePdfProps({ invoice, quote: null, customer: null, tenant });
    expect(p.total).toBe(38232);
    expect(p.subtotal).toBe(38232);
    expect(p.lineItems).toEqual([]);
  });
});

describe("buildQuotePdfProps", () => {
  const quote = {
    id: "Q-1", customer_name: "Acme", subtotal: 10000, discount_pct: 0, tax_rate: 18, amount: 11800,
    line_items: [], created_date: "2026-01-01", expires_date: "2026-01-15", notes: null, is_renewal: false,
  } as unknown as Quote;

  it("maps fields + computes validity days from the date span", () => {
    const p = buildQuotePdfProps({ quote, customer: null, tenant });
    expect(p.quoteId).toBe("Q-1");
    expect(p.total).toBe(11800);
    expect(p.validityDays).toBe(14);
    expect(p.tenantName).toBe("Anutech");
  });
});
