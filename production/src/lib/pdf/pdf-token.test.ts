import { describe, it, expect } from "vitest";
import { signPdfToken, verifyPdfToken, pdfDownloadUrl } from "./pdf-token";

describe("pdf-token", () => {
  const T = "t-123", I = "INV-ET-2026-27-0003";

  it("signs deterministically", () => {
    expect(signPdfToken("invoice", I, T)).toBe(signPdfToken("invoice", I, T));
    expect(signPdfToken("invoice", I, T)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies a correct token and rejects tampering", () => {
    const tok = signPdfToken("invoice", I, T);
    expect(verifyPdfToken("invoice", I, T, tok)).toBe(true);
    expect(verifyPdfToken("invoice", I, T, "")).toBe(false);
    expect(verifyPdfToken("invoice", I, T, tok.slice(0, -1) + "0")).toBe(false);
  });

  it("is scoped to type + id + tenant (no cross-use)", () => {
    const tok = signPdfToken("invoice", I, T);
    expect(verifyPdfToken("quote", I, T, tok)).toBe(false);       // wrong type
    expect(verifyPdfToken("invoice", "INV-OTHER", T, tok)).toBe(false); // wrong id
    expect(verifyPdfToken("invoice", I, "other-tenant", tok)).toBe(false); // wrong tenant
  });

  it("builds a download url carrying the token", () => {
    const url = pdfDownloadUrl("https://app.example.com/", "quote", "Q-1", T);
    expect(url).toBe(`https://app.example.com/api/v1/documents/quote/Q-1/pdf?token=${signPdfToken("quote", "Q-1", T)}`);
  });
});
