/**
 * POST /api/attendance/mark  { employeeId, pin }
 *
 * Server-side attendance mark. The office-network gate lives HERE, not on the
 * client: we read the REAL client IP from the Cloud Run x-forwarded-for header
 * (the browser can't forge it) and, if the tenant has locked an allowlist of
 * office IPs, reject anything from outside it. Then we call mark_attendance,
 * logging the source IP.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "";
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const employeeId = body?.employeeId as string | undefined;
  const pin = body?.pin as string | undefined;
  if (!employeeId || !pin) return NextResponse.json({ error: "Missing employee or PIN" }, { status: 400 });

  const ip = clientIp(request);

  // Office-network gate (opt-in): enforce only if the tenant locked an allowlist.
  const { data: settings } = await supabase
    .from("attendance_settings")
    .select("allowed_ips")
    .maybeSingle();
  const allowed = settings?.allowed_ips ?? [];
  if (allowed.length > 0 && !allowed.includes(ip)) {
    return NextResponse.json(
      { error: "You're not on the office network — attendance can only be marked at the office." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase.rpc("mark_attendance", {
    p_employee_id: employeeId,
    p_pin: pin,
    p_ip: ip || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ action: data as string });
}
