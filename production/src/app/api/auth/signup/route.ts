/**
 * POST /api/auth/signup
 *
 * Server-side signup using the service role key so we can:
 * 1. Create the auth user with email_confirm = true (no email verification needed)
 * 2. Create the tenant record
 * 3. Create the public.users record
 *
 * All three steps in one atomic flow — if any fails we roll back the auth user.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      email: string;
      password: string;
      fullName: string;
      companyName: string;
      gstin?: string;
    };

    const { email, password, fullName, companyName, gstin } = body;

    if (!email || !password || !fullName || !companyName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    // ── 1. Create auth user (auto-confirmed, no email needed) ──────────────
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,           // skip email verification
      user_metadata: {
        full_name: fullName,
        company_name: companyName,
        gstin: gstin ?? null,
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;
    const tenantId = crypto.randomUUID();

    // ── 2. Create tenant ───────────────────────────────────────────────────
    const { error: tenantError } = await admin.from("tenants").insert({
      id: tenantId,
      name: companyName,
      gstin: gstin || null,
      email,
    });

    if (tenantError) {
      // Rollback: delete the auth user we just created
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Tenant creation failed: " + tenantError.message }, { status: 500 });
    }

    // ── 3. Create public.users record ──────────────────────────────────────
    const { error: userError } = await admin.from("users").insert({
      id: userId,
      tenant_id: tenantId,
      email,
      full_name: fullName,
      initials: initials(fullName),
      role: "owner",
      color: "amber",
    });

    if (userError) {
      // Rollback: delete tenant + auth user
      await admin.from("tenants").delete().eq("id", tenantId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "User record creation failed: " + userError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, tenantId });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
