/**
 * POST /api/integrations/gemini/test — verify the saved Gemini key actually
 * works by issuing one tiny generateContent ping. Owner-only. Never returns the
 * key. Uses the resolver so it tests exactly what the AI features will use
 * (tenant key → env fallback).
 */
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveGeminiConfig } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function POST() {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 403 });
  const { data: me } = await supabase.from("users").select("tenant_id, role").eq("id", authData.user.id).single();
  if (!me) return NextResponse.json({ ok: false, error: "User not linked to a tenant" }, { status: 403 });
  if (me.role !== "owner") return NextResponse.json({ ok: false, error: "Owner only" }, { status: 403 });

  const admin = createAdminClient();
  const { apiKey, model } = await resolveGeminiConfig(admin, me.tenant_id);
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "No Gemini key configured (tenant or env)." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0 },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const msg = res.status === 400 || res.status === 403
        ? "Key rejected by Google — check the key + that the Generative Language API is enabled."
        : `Gemini returned ${res.status}.`;
      console.error("[integrations/gemini/test] failed:", res.status, detail.slice(0, 300));
      return NextResponse.json({ ok: false, error: msg }, { status: 200 });
    }
    return NextResponse.json({ ok: true, model });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Network error" }, { status: 200 });
  }
}
