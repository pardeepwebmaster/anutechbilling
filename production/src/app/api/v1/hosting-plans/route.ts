/**
 * GET /api/v1/hosting-plans
 *
 * Stage 5 foundation: read-only list of hosting plans defined in Billing's
 * own items catalog (vendor='hosting'), so Customer Panel can eventually
 * display/price hosting from here instead of its own HostingPlan model.
 *
 * NOT wired into Customer Panel's live checkout yet — that's a deliberate,
 * separate decision (changing what price a customer sees/pays deserves its
 * own review, not a quiet side-effect of this integration work). This
 * endpoint exists so that decision can be made independently of whether the
 * plumbing exists.
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { unauthorized, badRequest } from "@/lib/api/v1-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("items")
    .select("id, name, msrp, is_active")
    .eq("tenant_id", auth.tenantId)
    // Cast: database.types.ts hasn't been regenerated since migration 0169
    // added this enum value — see that migration's note.
    .eq("vendor", "hosting" as "google" | "microsoft" | "zoho" | "other")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) return badRequest("Could not load hosting plans");

  return NextResponse.json({
    plans: (data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      annual_price: item.msrp,
      currency: "INR",
    })),
  });
}
