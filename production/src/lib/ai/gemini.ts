/**
 * Gemini config resolver — single source of truth for "which API key + model
 * does this tenant's AI use?".
 *
 * Precedence:
 *   1. tenant_secrets.gemini_api_key  (set in Settings → Integrations → AI)
 *   2. process.env.GEMINI_API_KEY     (global Cloud Run fallback)
 *   3. null                           → callers use their deterministic stub
 *
 * Model: tenant_secrets.gemini_model → GEMINI_MODEL env → "gemini-1.5-flash".
 *
 * The raw key never leaves the server — callers use it to call the Gemini REST
 * API directly and only ever surface a masked preview in the integration UI.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface GeminiConfig {
  /** Usable API key, or null when neither tenant nor env has a valid one. */
  apiKey: string | null;
  model: string;
}

const DEFAULT_MODEL = "gemini-1.5-flash";

function valid(key: string | null | undefined): string | null {
  const k = key?.trim();
  if (!k || k === "..." || k.length < 10) return null;
  return k;
}

/**
 * Resolve the Gemini config for a tenant. Pass any Supabase client that can read
 * `tenant_secrets` for this tenant (an admin client, or a session client whose
 * RLS already scopes to the tenant). `tenantId` may be omitted/null to use the
 * env fallback only.
 */
export async function resolveGeminiConfig(
  client: SupabaseClient<Database>,
  tenantId?: string | null,
): Promise<GeminiConfig> {
  let key = valid(process.env.GEMINI_API_KEY);
  let model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  if (tenantId) {
    try {
      const { data } = await client
        .from("tenant_secrets")
        .select("gemini_api_key, gemini_model")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const tenantKey = valid(data?.gemini_api_key);
      if (tenantKey) key = tenantKey;           // tenant key wins over env
      if (data?.gemini_model?.trim()) model = data.gemini_model.trim();
    } catch {
      // fall back to env on any read error
    }
  }

  return { apiKey: key, model };
}
