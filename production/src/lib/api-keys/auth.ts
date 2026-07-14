/**
 * API-key authentication for the public integration API (/api/v1/*).
 *
 * Reads `Authorization: Bearer <key>` or `X-API-Key: <key>`, hashes it, and
 * resolves it to a tenant. Every /api/v1 handler MUST call this and scope all
 * queries to the returned tenantId — that is the cross-tenant isolation.
 *
 * Uses the service-role admin client (bypasses RLS) because there is no user
 * session on these requests — the key IS the credential.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hashApiKey } from "./keys";

export interface ApiAuth {
  tenantId: string;
  keyId: string;
  scopes: string[];
}

/** Pull the presented key from either supported header. */
function extractKey(req: NextRequest): string {
  const authz = req.headers.get("authorization") ?? "";
  if (authz.toLowerCase().startsWith("bearer ")) return authz.slice(7).trim();
  return (req.headers.get("x-api-key") ?? "").trim();
}

/**
 * Authenticate a request. Returns the tenant + scopes, or null if the key is
 * missing / unknown / revoked. Best-effort stamps last_used_at.
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiAuth | null> {
  const key = extractKey(req);
  if (!key) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, tenant_id, scopes, revoked_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Fire-and-forget usage stamp (don't block the response on it). Supabase
  // query builders are lazy — calling .then() is what actually executes it.
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {}, () => {});

  return { tenantId: data.tenant_id, keyId: data.id, scopes: data.scopes ?? [] };
}
