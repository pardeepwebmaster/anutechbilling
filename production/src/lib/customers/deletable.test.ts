import { describe, it, expect } from "vitest";
import { customerDeleteBlockReason } from "./deletable";

/**
 * A customer may only be deleted when it has NO money history — no
 * subscriptions (cascade would wipe them), payments, or invoices.
 */
describe("customerDeleteBlockReason", () => {
  it("allows deletion when the customer has no money history", () => {
    expect(customerDeleteBlockReason({ subscriptions: 0, payments: 0, invoices: 0 })).toBeNull();
  });

  it("blocks when there are subscriptions (cascade would delete them)", () => {
    const r = customerDeleteBlockReason({ subscriptions: 2, payments: 0, invoices: 0 });
    expect(r).toMatch(/2 subscriptions/);
  });

  it("blocks when there are payments or invoices", () => {
    expect(customerDeleteBlockReason({ subscriptions: 0, payments: 1, invoices: 0 })).toMatch(/1 payment/);
    expect(customerDeleteBlockReason({ subscriptions: 0, payments: 0, invoices: 3 })).toMatch(/3 invoices/);
  });

  it("lists every money record type that blocks the delete", () => {
    const r = customerDeleteBlockReason({ subscriptions: 1, payments: 2, invoices: 3 });
    expect(r).toMatch(/1 subscription/);
    expect(r).toMatch(/2 payments/);
    expect(r).toMatch(/3 invoices/);
  });
});
