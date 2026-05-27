/**
 * Supabase SERVER client — for Server Components, Route Handlers, Server Actions.
 *
 * Reads cookies from the Next.js request so session persists across SSR.
 * Uses the modern getAll/setAll cookie API.
 *
 * @example In a Server Component:
 *   const supabase = createClient();
 *   const { data } = await supabase.from("leads").select("*");
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — read-only cookies.
            // Middleware refreshes the session, so this is safe to ignore here.
          }
        },
      },
    },
  );
}

/**
 * Admin client using SERVICE_ROLE_KEY — bypasses RLS.
 * Use ONLY in trusted server code (route handlers, webhooks, migrations).
 * NEVER call from Server Components used in normal request flow.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          /* no-op — admin client doesn't manage session */
        },
      },
    },
  );
}
