import { describe, it, expect } from "vitest";
import { subscriptionStartDate } from "./subscription-dates";

/**
 * Twin of migration 0076: subscription start = line's start_date if set, else
 * the payment date. Renewal (start + 1yr) is left to Postgres interval math.
 */
describe("subscriptionStartDate", () => {
  const paymentDate = "2026-07-13";

  it("uses the line's start_date when the operator set one", () => {
    expect(subscriptionStartDate("2026-09-01", paymentDate)).toBe("2026-09-01");
    expect(subscriptionStartDate("2030-01-01", paymentDate)).toBe("2030-01-01");
  });

  it("falls back to the payment date when start_date is blank/null/undefined", () => {
    expect(subscriptionStartDate(undefined, paymentDate)).toBe(paymentDate);
    expect(subscriptionStartDate(null, paymentDate)).toBe(paymentDate);
    expect(subscriptionStartDate("", paymentDate)).toBe(paymentDate);
    expect(subscriptionStartDate("   ", paymentDate)).toBe(paymentDate);
  });
});
