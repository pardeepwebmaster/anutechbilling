/**
 * Sign-out handler — clears session and redirects to login.
 * @example <form action="/auth/sign-out" method="post"><button>Sign out</button></form>
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
