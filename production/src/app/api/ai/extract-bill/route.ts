/**
 * POST /api/ai/extract-bill
 *
 * Reads an uploaded vendor bill (image or PDF) with Gemini vision and returns
 * the fields needed to pre-fill the Add Vendor Bill form. ZERO money-write —
 * it only returns extracted values; the operator REVIEWS and edits them before
 * saving (AI can misread amounts, and this feeds GST input credit + P&L, so a
 * human must confirm). Tenant-scoped Gemini key (Settings → Integrations → AI).
 *
 * Body: { fileBase64: string (raw base64, no data: prefix), mimeType: string }
 * Returns: { fields: {...}, mode: "gemini" }  or  { error } with a helpful hint.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveGeminiConfig } from "@/lib/ai/gemini";

const bodySchema = z.object({
  fileBase64: z.string().min(20, "Empty file"),
  mimeType: z.string().min(3),
});

// The shape we ask Gemini to return (all optional — a bill may hide some fields).
interface ExtractedBill {
  vendor_name?:  string | null;
  vendor_gstin?: string | null;
  bill_no?:      string | null;
  bill_date?:    string | null;   // YYYY-MM-DD
  subtotal?:     number | null;   // pre-GST, ₹ integer
  cgst?:         number | null;
  sgst?:         number | null;
  igst?:         number | null;
  total?:        number | null;   // incl GST
  category_guess?: string | null;
}

const PROMPT =
  "You are reading an INDIAN vendor/supplier tax invoice (e.g. Google Cloud/Workspace, " +
  "Microsoft, Zoho, or any supplier) for a cloud reseller's books. Extract these fields " +
  "and return ONLY JSON, no prose:\n" +
  "{\n" +
  '  "vendor_name": string|null,        // the SUPPLIER who issued the bill (not the buyer)\n' +
  '  "vendor_gstin": string|null,       // 15-char GSTIN of the supplier if printed\n' +
  '  "bill_no": string|null,            // the invoice/bill number\n' +
  '  "bill_date": string|null,          // invoice date as YYYY-MM-DD\n' +
  '  "subtotal": number|null,           // taxable value BEFORE GST, in rupees, integer (round)\n' +
  '  "cgst": number|null,               // CGST amount in rupees, integer (0 if not shown)\n' +
  '  "sgst": number|null,               // SGST amount in rupees, integer (0 if not shown)\n' +
  '  "igst": number|null,               // IGST amount in rupees, integer (0 if not shown)\n' +
  '  "total": number|null,              // grand total INCLUDING GST, in rupees, integer\n' +
  '  "category_guess": string|null      // "COGS-Workspace" for Google, "COGS-M365" for Microsoft, "COGS-Zoho" for Zoho, else null\n' +
  "}\n" +
  "RULES: amounts are integer rupees (drop paise/decimals, round to nearest rupee). " +
  "Never invent a value — use null if the bill does not clearly show it. " +
  "A bill has EITHER (CGST+SGST) for intra-state OR IGST for inter-state, not both. " +
  "vendor_name is the SELLER, never the reseller/buyer.";

async function extractWithGemini(apiKey: string, model: string, mimeType: string, base64: string): Promise<ExtractedBill | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    if (!res.ok) {
      console.error("[ai/extract-bill] Gemini failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as ExtractedBill;
  } catch (err) {
    console.error("[ai/extract-bill] Gemini crashed:", err);
    return null;
  }
}

const toInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
};

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Only images + PDF are readable by Gemini vision.
  if (!/^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/i.test(parsed.mimeType)) {
    return NextResponse.json({ error: "Upload a photo (JPG/PNG) or PDF of the bill." }, { status: 400 });
  }

  const { data: me } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  const gemini = await resolveGeminiConfig(supabase, me?.tenant_id ?? null);
  if (!gemini.apiKey) {
    return NextResponse.json(
      { error: "AI reading isn't set up. Add your Gemini key in Settings → Integrations → AI, or fill the bill by hand." },
      { status: 400 },
    );
  }

  const ai = await extractWithGemini(gemini.apiKey, gemini.model, parsed.mimeType, parsed.fileBase64);
  if (!ai) {
    return NextResponse.json({ error: "Couldn't read this bill. Try a clearer photo/PDF, or enter it by hand." }, { status: 502 });
  }

  // Sanitise → integers / trimmed strings. Everything stays a suggestion the
  // operator verifies in the form.
  const fields = {
    vendor_name:  (ai.vendor_name ?? "").toString().trim() || null,
    vendor_gstin: (ai.vendor_gstin ?? "").toString().trim().toUpperCase() || null,
    bill_no:      (ai.bill_no ?? "").toString().trim() || null,
    bill_date:    /^\d{4}-\d{2}-\d{2}$/.test((ai.bill_date ?? "").toString()) ? (ai.bill_date as string) : null,
    subtotal:     toInt(ai.subtotal),
    cgst:         toInt(ai.cgst) ?? 0,
    sgst:         toInt(ai.sgst) ?? 0,
    igst:         toInt(ai.igst) ?? 0,
    total:        toInt(ai.total),
    category_guess: (ai.category_guess ?? "").toString().trim() || null,
  };

  return NextResponse.json({ fields, mode: "gemini" });
}
