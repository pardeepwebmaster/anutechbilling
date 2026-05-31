import { describe, it, expect } from "vitest";
import { isInterStateSupply } from "./place-of-supply";

describe("isInterStateSupply", () => {
  it("intra-state: same state code → false (CGST + SGST)", () => {
    expect(isInterStateSupply("07", "07")).toBe(false); // Delhi → Delhi
    expect(isInterStateSupply("27", "27")).toBe(false); // Maharashtra → Maharashtra
  });

  it("inter-state: different state codes → true (IGST)", () => {
    expect(isInterStateSupply("27", "07")).toBe(true); // Maharashtra buyer, Delhi seller
    expect(isInterStateSupply("07", "27")).toBe(true); // Delhi buyer, Maharashtra seller
  });

  it("conservative default: missing customer state → false", () => {
    expect(isInterStateSupply(null, "07")).toBe(false);
    expect(isInterStateSupply(undefined, "07")).toBe(false);
    expect(isInterStateSupply("", "07")).toBe(false);
  });

  it("conservative default: missing seller state → false (even for a real different-state customer)", () => {
    // This is the degraded case the /setup GST profile must prevent: with no
    // seller state_code we cannot know the head, so we fall back to intra-state.
    expect(isInterStateSupply("27", null)).toBe(false);
    expect(isInterStateSupply("27", undefined)).toBe(false);
    expect(isInterStateSupply("27", "")).toBe(false);
  });

  it("both missing → false", () => {
    expect(isInterStateSupply(null, null)).toBe(false);
  });
});
