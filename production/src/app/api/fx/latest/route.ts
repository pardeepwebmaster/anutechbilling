/**
 * GET /api/fx/latest?from=USD  →  latest ₹ (INR) per 1 unit of `from`.
 *
 * Used by the quote / invoice builder's "International billing" block to
 * auto-fill the exchange rate (₹ per foreign unit) so the operator doesn't
 * hand-type a stale number. Fetched server-side (no CORS, cached ~1h) from a
 * free FX provider, with a fallback provider for resilience.
 *
 * NOT a money-write: it only returns a suggested rate. The operator still sees
 * the number, can override it, and it is stamped onto the quote at save — so a
 * wrong/blank fetch never silently corrupts the books (the ₹ canonical amount
 * = foreign × exchange_rate is always derived from the value the operator
 * confirms).
 */
import { NextResponse, type NextRequest } from "next/server";

const TO = "INR";
// Only currencies we actually bill in — rejects junk input.
const ALLOWED = new Set(["USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "INR"]);

interface FxResult {
  rate: number;
  from: string;
  to: string;
  asOf: string | null;
  source: string;
}

/** Primary: open.er-api.com (free, no key, ~daily, wide coverage incl. AED/SGD). */
async function fromErApi(from: string): Promise<FxResult | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string; rates?: Record<string, number>; time_last_update_utc?: string;
    };
    const rate = data?.result === "success" ? data.rates?.[TO] : undefined;
    if (typeof rate !== "number" || !(rate > 0)) return null;
    return { rate, from, to: TO, asOf: data.time_last_update_utc ?? null, source: "er-api" };
  } catch {
    return null;
  }
}

/** Fallback: frankfurter.app (ECB data — majors only, no AED). */
async function fromFrankfurter(from: string): Promise<FxResult | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${TO}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number>; date?: string };
    const rate = data?.rates?.[TO];
    if (typeof rate !== "number" || !(rate > 0)) return null;
    return { rate, from, to: TO, asOf: data.date ?? null, source: "frankfurter" };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const from = (request.nextUrl.searchParams.get("from") ?? "").toUpperCase().trim();
  if (!ALLOWED.has(from)) {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }
  if (from === TO) {
    return NextResponse.json({ rate: 1, from, to: TO, asOf: null, source: "identity" });
  }

  const result = (await fromErApi(from)) ?? (await fromFrankfurter(from));
  if (!result) {
    return NextResponse.json(
      { error: "Couldn't fetch the latest rate right now. Enter it manually." },
      { status: 502 },
    );
  }

  // Round to 4 dp — enough precision for invoicing, avoids float noise.
  return NextResponse.json({ ...result, rate: Math.round(result.rate * 10000) / 10000 });
}
