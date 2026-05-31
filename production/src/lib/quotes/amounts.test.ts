import { describe, it, expect } from "vitest";
import { grossAmount } from "./amounts";

describe("grossAmount", () => {
  it("adds 18% GST to a Standard ×10 annual renewal subtotal", () => {
    // 10 seats × ₹864/mo × 12 = ₹1,03,680 ex-GST → ₹1,22,342 incl 18% GST
    expect(grossAmount(103680, 18)).toBe(122342);
  });

  it("defaults to 18%", () => {
    expect(grossAmount(103680)).toBe(122342);
  });

  it("rounds the tax (half-up) like the quote builder", () => {
    // 103680 * 0.18 = 18662.4 → 18662
    expect(grossAmount(103680, 18) - 103680).toBe(18662);
  });

  it("handles zero", () => {
    expect(grossAmount(0, 18)).toBe(0);
  });

  it("handles a 2-year extension subtotal (mrr×12×2)", () => {
    // 8640×12×2 = 207360 ex-GST → 207360 + 37325 = 244685
    expect(grossAmount(207360, 18)).toBe(244685);
  });

  it("supports other GST rates", () => {
    expect(grossAmount(1000, 5)).toBe(1050);
    expect(grossAmount(1000, 0)).toBe(1000);
  });
});
