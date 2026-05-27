/**
 * POST /api/integrations/whatsapp/test
 *
 * Verifies WhatsApp credentials are wired correctly by hitting Meta's
 * Phone Number lookup endpoint (read-only, no message sent).
 *   GET https://graph.facebook.com/v18.0/{phone_number_id}
 *   Headers: Authorization: Bearer {access_token}
 *
 * A 200 means the access_token is valid AND has scope on this phone
 * number — the two failure modes that block sending messages.
 *
 * Owner-only. No body required; reads creds from tenant_secrets.
 */

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const META_GRAPH_BASE = "https://graph.facebook.com/v18.0";

export async function POST() {
  // Auth + tenant resolution — same gate as the credential save endpoint.
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", authData.user.id)
    .single();
  if (!me) return NextResponse.json({ ok: false, error: "No tenant" }, { status: 403 });
  if (me.role !== "owner") return NextResponse.json({ ok: false, error: "Owner only" }, { status: 403 });

  const admin = createAdminClient();
  const { data: secrets } = await admin
    .from("tenant_secrets")
    .select("whatsapp_phone_number_id, whatsapp_access_token, whatsapp_provider")
    .eq("tenant_id", me.tenant_id)
    .maybeSingle();
  if (!secrets?.whatsapp_phone_number_id || !secrets.whatsapp_access_token) {
    return NextResponse.json({ ok: false, error: "Save credentials first" }, { status: 400 });
  }
  if (secrets.whatsapp_provider && secrets.whatsapp_provider !== "meta") {
    return NextResponse.json({ ok: false, error: `Test is only wired for Meta Cloud API; provider is ${secrets.whatsapp_provider}` }, { status: 400 });
  }

  const url = `${META_GRAPH_BASE}/${encodeURIComponent(secrets.whatsapp_phone_number_id)}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method:  "GET",
      headers: {
        "Authorization": `Bearer ${secrets.whatsapp_access_token}`,
        "Accept":        "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Network error reaching Meta" },
      { status: 502 },
    );
  }

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const friendly =
      // Meta puts useful info in .error.message
      (json && typeof json === "object" && (json as { error?: { message?: string } }).error?.message) ??
      `Meta responded ${resp.status}`;
    return NextResponse.json({ ok: false, error: friendly }, { status: 400 });
  }

  return NextResponse.json({
    ok:              true,
    verified_name:   (json as { verified_name?: string }).verified_name        ?? null,
    display_number:  (json as { display_phone_number?: string }).display_phone_number ?? null,
    quality_rating:  (json as { quality_rating?: string }).quality_rating      ?? null,
    code_verified:   (json as { code_verification_status?: string }).code_verification_status ?? null,
  });
}
