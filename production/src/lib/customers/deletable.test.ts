import { describe, it, expect } from "vitest";
import { customerDeleteBlockReason } from "./deletable";

/**
 * Zoho-Books parity: a customer may only be deleted when it is truly empty —
 * NO subscriptions (cascade would wipe them), payments, invoices, quotes, or
 * projects. Anything else → archive instead.
 */
const EMPTY = { subscriptions: 0, payments: 0, invoices: 0, quotes: 0, projects: 0 };

describe("customerDeleteBlockReason", () => {
  it("allows deletion when the customer has no documents at all", () => {
    expect(customerDeleteBlockReason(EMPTY)).toBeNull();
  });

  it("blocks when there are subscriptions (cascade would delete them)", () => {
    const r = customerDeleteBlockReason({ ...EMPTY, subscriptions: 2 });
    expect(r).toMatch(/2 subscriptions/);
  });

  it("blocks when there are payments or invoices", () => {
    expect(customerDeleteBlockReason({ ...EMPTY, payments: 1 })).toMatch(/1 payment/);
    expect(customerDeleteBlockReason({ ...EMPTY, invoices: 3 })).toMatch(/3 invoices/);
  });

  it("blocks when there are quotes or projects (Zoho treats them as documents)", () => {
    expect(customerDeleteBlockReason({ ...EMPTY, quotes: 1 })).toMatch(/1 quote/);
    expect(customerDeleteBlockReason({ ...EMPTY, projects: 2 })).toMatch(/2 projects/);
  });

  it("lists every document type that blocks the delete", () => {
    const r = customerDeleteBlockReason({ subscriptions: 1, payments: 2, invoices: 3, quotes: 4, projects: 5 });
    expect(r).toMatch(/1 subscription/);
    expect(r).toMatch(/2 payments/);
    expect(r).toMatch(/3 invoices/);
    expect(r).toMatch(/4 quotes/);
    expect(r).toMatch(/5 projects/);
  });
});
