/**
 * Sign-out handler — clears session and redirects to login.
 * @example <form action="/auth/sign-out" method="post"><button>Sign out</button></form>
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  // Public host — never new URL(request.url).origin (Cloud Run internal bind
  // is 0.0.0.0:3000 → dead redirect).
  const fwdHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto   = request.headers.get("x-forwarded-proto") ?? "https";
  const origin  = fwdHost
    ? `${proto}://${fwdHost}`
    : (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? new URL(request.url).origin);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
