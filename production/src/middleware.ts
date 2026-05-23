/**
 * Root middleware — runs on every matched request.
 *
 * Responsibilities:
 * 1. Refresh Supabase auth session cookies
 * 2. Gate (app)/* routes behind authentication
 * 3. Redirect authenticated users away from (auth)/* routes
 */
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/client";

// Routes that require authentication (the entire app shell)
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/leads",
  "/customers",
  "/items",
  "/online-orders",
  "/quotes",
  "/invoices",
  "/subscriptions",
  "/renewals",
  "/whatsapp",
  "/automations",
  "/campaigns",
  "/reports",
  "/support",
  "/setup",
  "/settings",
  "/mobile",
  "/lead-gen",
];

// Routes that should redirect to /dashboard if user is logged in
const AUTH_PREFIXES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If Supabase isn't configured yet, just let everything pass.
  // (Until the operator pastes real env vars, we don't enforce auth.)
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  // DEMO_MODE: bypass auth in local dev for screenshots / UI review.
  // Controlled by NEXT_PUBLIC_DEMO_MODE=true in .env.local only.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const isAuthed = !!user;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  // Not logged in → block protected routes
  if (!isAuthed && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged in → redirect away from auth pages
  if (isAuthed && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets + Next internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
