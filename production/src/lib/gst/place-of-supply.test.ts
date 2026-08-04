import { describe, it, expect } from "vitest";
import { isInterStateSupply, isExportSupply, gstTreatment } from "./place-of-supply";

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

describe("isExportSupply", () => {
  it("India (any spelling) → domestic, not export", () => {
    for (const c of ["India", "india", "IN", "in", "Bharat", "IND"]) {
      expect(isExportSupply(c)).toBe(false);
    }
  });

  it("any other country → export", () => {
    for (const c of ["United States", "USA", "US", "Singapore", "UAE", "Germany"]) {
      expect(isExportSupply(c)).toBe(true);
    }
  });

  it("conservative default: missing/empty country → domestic (never accidentally zero-rate)", () => {
    expect(isExportSupply(null)).toBe(false);
    expect(isExportSupply(undefined)).toBe(false);
    expect(isExportSupply("")).toBe(false);
    expect(isExportSupply("   ")).toBe(false);
  });
});

describe("gstTreatment", () => {
  it("export beats the state comparison", () => {
    // Even if a stray Indian state code is present, a foreign country → export.
    expect(gstTreatment("USA", "27", "07")).toBe("export");
    expect(gstTreatment("Singapore", null, "07")).toBe("export");
  });

  it("domestic same-state → intra_state (CGST + SGST)", () => {
    expect(gstTreatment("India", "07", "07")).toBe("intra_state");
    expect(gstTreatment(null, "27", "27")).toBe("intra_state");
  });

  it("domestic different-state → inter_state (IGST)", () => {
    expect(gstTreatment("India", "27", "07")).toBe("inter_state");
  });

  it("unknown country + unknown state → intra_state (safe default, taxed)", () => {
    expect(gstTreatment(null, null, "07")).toBe("intra_state");
  });
});
