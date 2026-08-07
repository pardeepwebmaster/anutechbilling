import { describe, it, expect } from "vitest";
import { nationalHolidaysForYear, FIXED_NATIONAL_HOLIDAYS } from "./holidays-india";

describe("nationalHolidaysForYear", () => {
  it("returns the three fixed national holidays for the given year", () => {
    expect(nationalHolidaysForYear(2026)).toEqual(["2026-01-26", "2026-08-15", "2026-10-02"]);
  });
  it("scales to any year", () => {
    expect(nationalHolidaysForYear(2027)).toEqual(["2027-01-26", "2027-08-15", "2027-10-02"]);
  });
  it("only fixed-date national holidays (no guessed festivals)", () => {
    expect(FIXED_NATIONAL_HOLIDAYS).toHaveLength(3);
  });
});
