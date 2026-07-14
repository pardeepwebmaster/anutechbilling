/**
 * API key generation + hashing (server-only — uses node:crypto).
 *
 * We store only the SHA-256 hash of a key. The plaintext is shown to the owner
 * exactly once at creation and never persisted. Auth looks a key up by hashing
 * the presented value and matching the stored hash.
 */
import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "ros_live_";

export interface GeneratedKey {
  /** Full secret — shown to the owner ONCE, never stored. */
  plaintext: string;
  /** SHA-256 hex of the plaintext — this is what we store + look up by. */
  hash: string;
  /** Leading, non-secret slice shown in the UI to identify the key. */
  keyPrefix: string;
}

/** SHA-256 hex of a key's plaintext. Trims surrounding whitespace first. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim()).digest("hex");
}

/** Mint a fresh key: `ros_live_<48 hex>`. */
export function generateApiKey(): GeneratedKey {
  const secret = randomBytes(24).toString("hex"); // 48 hex chars
  const plaintext = KEY_PREFIX + secret;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    keyPrefix: plaintext.slice(0, 16), // "ros_live_" + 7 chars
  };
}
