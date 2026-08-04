/**
 * Text-to-speech (Phase 0 of the voice-agent plan) — turns a short Hindi/Hinglish
 * reminder script into audio for a WhatsApp voice note. NO telephony/DLT.
 *
 * Provider: Sarvam AI (Bulbul) — best Indic/Hinglish per the voice-agent research.
 * Key from env SARVAM_API_KEY (a global key is fine while only Excel/Anutech are
 * live; per-tenant keys can move to tenant_secrets later, mirroring gemini.ts).
 *
 * STUB-FIRST: returns null when no key is set (or on any provider error) so the
 * caller degrades gracefully — the feature simply reports "voice not configured"
 * instead of crashing, exactly like the Gemini + WhatsApp seams.
 */

const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

export interface TtsResult {
  base64: string; // base64-encoded audio
  mime: string; // e.g. "audio/wav"
}

function valid(key: string | null | undefined): string | null {
  const k = key?.trim();
  if (!k || k.length < 10) return null;
  return k;
}

/**
 * Synthesize speech for a SHORT script (Sarvam caps input length, so keep the
 * reminder to a few sentences). Returns null when TTS isn't configured or fails.
 * @param text  the spoken script (Hinglish ok)
 * @param lang  BCP-47ish target, default Hindi
 */
export async function synthesizeSpeech(
  text: string,
  lang: "hi-IN" | "en-IN" = "hi-IN",
): Promise<TtsResult | null> {
  const key = valid(process.env.SARVAM_API_KEY);
  if (!key) return null; // stub: not configured

  const trimmed = text.trim().slice(0, 480); // Sarvam per-input char cap
  if (!trimmed) return null;

  try {
    const res = await fetch(SARVAM_TTS_URL, {
      method: "POST",
      headers: { "api-subscription-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        inputs: [trimmed],
        target_language_code: lang,
        speaker: "meera",
        model: "bulbul:v2",
        speech_sample_rate: 22050,
        enable_preprocessing: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("[voice/tts] Sarvam failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { audios?: string[] };
    const audio = data.audios?.[0];
    if (!audio) return null;
    return { base64: audio, mime: "audio/wav" };
  } catch (err) {
    console.error("[voice/tts] Sarvam crashed:", err);
    return null;
  }
}
