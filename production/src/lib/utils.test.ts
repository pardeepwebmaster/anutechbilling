import { describe, it, expect } from "vitest";
import { endOfDayIST, isQuoteExpired } from "./utils";

describe("endOfDayIST", () => {
  it("maps a YYYY-MM-DD to 23:59:59.999 IST == 18:29:59.999 UTC same date", () => {
    expect(endOfDayIST("2026-06-30").toISOString()).toBe("2026-06-30T18:29:59.999Z");
  });
  it("tolerates a full ISO timestamp (uses the date part only)", () => {
    expect(endOfDayIST("2026-06-30T00:00:00.000Z").toISOString()).toBe("2026-06-30T18:29:59.999Z");
  });
});

describe("isQuoteExpired (end-of-day IST)", () => {
  const EXP = "2026-06-30"; // quote valid until 30 Jun 2026

  it("NOT expired at dawn IST on the last valid day (the old-bug case)", () => {
    // 2026-06-30 05:30 IST == 2026-06-30 00:00 UTC. Old code wrongly expired here.
    expect(isQuoteExpired(EXP, new Date("2026-06-30T00:00:00.000Z"))).toBe(false);
  });

  it("NOT expired late evening IST on the last valid day", () => {
    // 2026-06-30 23:00 IST == 2026-06-30 17:30 UTC
    expect(isQuoteExpired(EXP, new Date("2026-06-30T17:30:00.000Z"))).toBe(false);
  });

  it("expired just after midnight IST the next day", () => {
    // 2026-07-01 00:30 IST == 2026-06-30 19:00 UTC
    expect(isQuoteExpired(EXP, new Date("2026-06-30T19:00:00.000Z"))).toBe(true);
  });

  it("expired well into the next day", () => {
    expect(isQuoteExpired(EXP, new Date("2026-07-05T10:00:00.000Z"))).toBe(true);
  });

  it("no expiry date → never expired", () => {
    expect(isQuoteExpired(null, new Date("2030-01-01T00:00:00.000Z"))).toBe(false);
    expect(isQuoteExpired(undefined)).toBe(false);
  });
});
