/**
 * /portal/auth/callback — magic-link landing for customer portal.
 *
 *  1. Exchanges the auth code for a session (sets cookies)
 *  2. Looks up a `customers` row matching the user's email
 *  3. INSERTs/UPDATEs a `customer_users` row linking auth user → customer
 *  4. Redirects to /portal/dashboard
 *
 * Error redirects:
 *  - no code              → /portal/login?error=auth_failed
 *  - code exchange fails  → /portal/login?error=auth_failed
 *  - no matching customer → /portal/login?error=no_customer
 *
 * Uses the admin (service-role) client for the customer lookup + link
 * insert because the new auth user has no `customer_users` row yet,
 * so RLS would block them from reading `customers`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // Build redirects from the PUBLIC host — NEVER new URL(request.url).origin.
  // On Cloud Run the container binds 0.0.0.0:3000, so request.url's origin is the
  // internal address and yields dead https://0.0.0.0:3000 links (broke every
  // portal magic-link login). Prefer the forwarded host the customer actually
  // used, then NEXT_PUBLIC_APP_URL, then (last resort) the raw origin.
  const fwdHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto   = request.headers.get("x-forwarded-proto") ?? "https";
  const origin  = fwdHost
    ? `${proto}://${fwdHost}`
    : (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? new URL(request.url).origin);

  if (!code) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  const supabase = createClient();
  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchErr) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  // Pull the freshly-authed user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  // Already linked?
  const { data: existingLink } = await supabase
    .from("customer_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existingLink) {
    return NextResponse.redirect(`${origin}/portal/dashboard`);
  }

  // Find a customer by email (case-insensitive). Admin client bypasses RLS
  // because the user has no link row yet → can't read customers normally.
  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id, tenant_id, contact_email")
    .ilike("contact_email", user.email)
    .limit(1)
    .maybeSingle();

  if (!customer) {
    // Sign them out so they don't end up half-authed with no portal access
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/portal/login?error=no_customer`);
  }

  // Insert the link
  const { error: linkErr } = await admin
    .from("customer_users")
    .insert({
      tenant_id:     customer.tenant_id,
      customer_id:   customer.id,
      auth_user_id:  user.id,
      email:         user.email,
      role:          "admin",
      last_login_at: new Date().toISOString(),
    });
  if (linkErr) {
    console.error("[portal/auth/callback] link insert failed:", linkErr);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}/portal/dashboard`);
}
