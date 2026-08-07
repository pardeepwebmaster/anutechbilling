/**
 * POST /api/customers/notify-deleted   { billingCustomerId }
 *
 * Session-authenticated (same permission level as deleting the customer
 * itself — any signed-in tenant user). Called client-side right after a
 * successful delete_customer RPC call, to tell Customer Panel to drop its
 * now-stale reference to this customer. Best-effort: a failure here must
 * never surface as the delete itself having failed — the customer really
 * is gone from Billing either way.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { billingCustomerId?: string } | null;
  const billingCustomerId = body?.billingCustomerId?.trim();
  if (!billingCustomerId) {
    return NextResponse.json({ error: "billingCustomerId is required" }, { status: 400 });
  }

  const apiUrl = process.env.CUSTOMER_PANEL_API_URL;
  const apiKey = process.env.CUSTOMER_PANEL_PROVISION_API_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ notified: false, reason: "not configured" });
  }

  try {
    await fetch(`${apiUrl.replace(/\/$/, "")}/api/integrations/billing/unlink-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Integration-Key": apiKey },
      body: JSON.stringify({ billingCustomerId }),
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json({ notified: true });
  } catch {
    return NextResponse.json({ notified: false, reason: "unreachable" });
  }
}
