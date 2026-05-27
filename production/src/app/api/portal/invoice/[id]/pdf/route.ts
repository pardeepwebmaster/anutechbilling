/**
 * /api/portal/invoice/[id]/pdf — placeholder for customer-portal invoice
 * PDF download.
 *
 * Phase 1 stub: returns 503 with a friendly message. Phase 2 will render
 * the PDF server-side using the existing @react-pdf/renderer pipeline
 * (lib/pdf/InvoicePDF.tsx) after verifying portal session + invoice
 * ownership.
 *
 * Until then customers see a graceful message instead of a broken link.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getPortalSession } from "@/lib/portal/session";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:   "PDF download is being set up. WhatsApp Pardeep on +91 99999 30300 — he'll email you the GST invoice within an hour.",
      invoice: params.id,
      portal:  "Phase 2 will wire @react-pdf/renderer server-side here.",
    },
    { status: 503 },
  );
}
