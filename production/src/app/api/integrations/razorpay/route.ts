/**
 * Razorpay integration — read + save the per-tenant API credentials.
 *
 *   GET  → existence + mode + masked previews + webhook URL
 *   POST → upsert credentials (key_id prefix decides test/live mode)
 *   DELETE → clear credentials
 *
 * Public-key vs server-key distinction:
 *   - key_id (rzp_test_/rzp_live_...) is safe to surface to the client
 *     when launching the Razorpay Checkout widget.
 *   - key_secret + webhook_secret NEVER leave the server.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const saveSchema = z.object({
  key_id:         z.string().trim().min(10).max(80)
                    .refine((v) => /^rzp_(test|live)_/.test(v),
                            "Key ID must start with rzp_test_ or rzp_live_"),
  key_secret:     z.string().trim().min(10).max(200),
  webhook_secret: z.string().trim().max(200).optional(),
});

function mask(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length <= 8) return "•".repeat(t.length);
  return `${t.slice(0, 4)}••••${t.slice(-4)}`;
}

async function resolveTenantAndOwnership() {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return { error: "Not authenticated" as const };
  const { data: me, error } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", authData.user.id)
    .single();
  if (error || !me) return { error: "User not linked to a tenant" as const };
  if (me.role !== "owner") return { error: "Only the workspace owner can manage integration credentials" as const };
  return { tenantId: me.tenant_id };
}

function webhookUrlFor(tenantId: string, req: NextRequest): string {
  const origin = req.nextUrl.origin;
  // Razorpay routes don't currently use the tenant query param — but we
  // surface it on the URL anyway so future multi-tenant webhook routing
  // can pick it up without changing the dashboard config.
  return `${origin}/api/webhooks/razorpay?tenant=${encodeURIComponent(tenantId)}`;
}

export async function GET(req: NextRequest) {
  const r = await resolveTenantAndOwnership();
  if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_secrets")
    .select("razorpay_mode, razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, updated_at")
    .eq("tenant_id", r.tenantId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:                    true,
    configured:            Boolean(data?.razorpay_key_id && data.razorpay_key_secret),
    mode:                  data?.razorpay_mode ?? "test",
    key_id:                data?.razorpay_key_id ?? null,
    key_secret_mask:       mask(data?.razorpay_key_secret),
    webhook_secret_mask:   mask(data?.razorpay_webhook_secret),
    webhook_url:           webhookUrlFor(r.tenantId, req),
    updated_at:            data?.updated_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const r = await resolveTenantAndOwnership();
  if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }
  const v = parsed.data;
  // Mode is inferred from the key_id prefix — single source of truth.
  const mode = v.key_id.startsWith("rzp_live_") ? "live" : "test";

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_secrets")
    .upsert({
      tenant_id:               r.tenantId,
      razorpay_mode:           mode,
      razorpay_key_id:         v.key_id,
      razorpay_key_secret:     v.key_secret,
      razorpay_webhook_secret: v.webhook_secret ?? null,
    }, { onConflict: "tenant_id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mode });
}

export async function DELETE() {
  const r = await resolveTenantAndOwnership();
  if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_secrets")
    .update({
      razorpay_key_id:         null,
      razorpay_key_secret:     null,
      razorpay_webhook_secret: null,
    })
    .eq("tenant_id", r.tenantId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
