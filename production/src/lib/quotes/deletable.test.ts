import { describe, it, expect } from "vitest";
import { quoteDeleteBlockReason } from "./deletable";

/**
 * Money-correctness guard: payments.quote_id is ON DELETE CASCADE, so a quote
 * that already carries a recorded payment must never be deletable — otherwise
 * deleting it silently wipes the payment ledger + audit trail.
 */
describe("quoteDeleteBlockReason", () => {
  it("allows deletion when no payment has been recorded", () => {
    for (const payment_status of ["none", "awaiting"] as const) {
      expect(quoteDeleteBlockReason({ payment_status })).toBeNull();
    }
  });

  it("allows deletion when payment_status is null/undefined", () => {
    // Older rows may have no payment_status set yet.
    expect(quoteDeleteBlockReason({ payment_status: null as never })).toBeNull();
  });

  it("blocks deletion once money is in flight (partial / received / invoiced)", () => {
    for (const payment_status of ["partial", "received", "invoiced"] as const) {
      const reason = quoteDeleteBlockReason({ payment_status });
      expect(reason).toBeTruthy();
      expect(reason).toMatch(/payment/i);
    }
  });
});
