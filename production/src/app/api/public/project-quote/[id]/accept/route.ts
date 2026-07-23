/**
 * POST /api/public/project-quote/[id]/accept
 *
 * Customer-side: accept a project quotation → it becomes an active project.
 * Uses the admin client (customer isn't authenticated). The project id (a
 * random uuid) is the implicit link secret. accept_project_quote only flips
 * 'quoted' → 'active', so it's safe to expose.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("accept_project_quote", { p_project_id: params.id });

  if (error) {
    const status = error.code === "no_data_found" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, result: data });
}
