import { describe, it, expect } from "vitest";
import { quoteAcceptPath, quoteAcceptUrl } from "./accept-link";
import { quoteTokenMatches } from "./accept-token";

describe("quoteAcceptPath / quoteAcceptUrl", () => {
  it("builds a path with the token query", () => {
    expect(quoteAcceptPath("Q-ET-2026-27-0001", "tok-123"))
      .toBe("/quote/Q-ET-2026-27-0001/accept?t=tok-123");
  });
  it("strips a trailing slash from the base and joins", () => {
    expect(quoteAcceptUrl("https://app.example.com/", "Q-1", "tok-9"))
      .toBe("https://app.example.com/quote/Q-1/accept?t=tok-9");
  });
  it("url-encodes id and token", () => {
    expect(quoteAcceptPath("Q A/1", "a b")).toBe("/quote/Q%20A%2F1/accept?t=a%20b");
  });
});

describe("quoteTokenMatches", () => {
  it("true for an exact match", () => {
    expect(quoteTokenMatches("abc-123", "abc-123")).toBe(true);
  });
  it("false for a mismatch", () => {
    expect(quoteTokenMatches("abc-123", "abc-124")).toBe(false);
  });
  it("false for different lengths", () => {
    expect(quoteTokenMatches("abc", "abc-123")).toBe(false);
  });
  it("false for null/empty/undefined on either side", () => {
    expect(quoteTokenMatches(null, "abc")).toBe(false);
    expect(quoteTokenMatches("abc", null)).toBe(false);
    expect(quoteTokenMatches("", "")).toBe(false);
    expect(quoteTokenMatches(undefined, undefined)).toBe(false);
  });
});
