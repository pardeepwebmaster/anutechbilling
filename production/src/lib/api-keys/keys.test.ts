import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey } from "./keys";

describe("hashApiKey", () => {
  it("is deterministic and trims whitespace", () => {
    expect(hashApiKey("abc")).toBe(hashApiKey("abc"));
    expect(hashApiKey("  abc  ")).toBe(hashApiKey("abc"));
  });
  it("produces a 64-char sha256 hex", () => {
    expect(hashApiKey("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("differs for different inputs", () => {
    expect(hashApiKey("a")).not.toBe(hashApiKey("b"));
  });
});

describe("generateApiKey", () => {
  it("returns a prefixed plaintext whose hash + prefix are consistent", () => {
    const k = generateApiKey();
    expect(k.plaintext.startsWith("ros_live_")).toBe(true);
    expect(k.hash).toBe(hashApiKey(k.plaintext));
    expect(k.keyPrefix).toBe(k.plaintext.slice(0, 16));
  });
  it("mints unique keys", () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
  });
});
