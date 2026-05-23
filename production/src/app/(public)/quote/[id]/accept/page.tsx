/**
 * Public quote-accept page — what the customer sees when they click the
 * link in the quote email/WhatsApp message.
 *
 * Server Component: fetches via admin client (bypasses RLS since the customer
 * isn't logged in). Quote ID is the secret — short, B2B context, low enumeration risk.
 *
 * Customer can accept, request changes, or print the quote here.
 */
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import type { Quote, QuoteLineItem, LineCommitment } from "@/lib/supabase/database.types";
import { QuoteAcceptView } from "./quote-accept-view";

export const dynamic = "force-dynamic"; // never cache — quotes change state

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  // Resolve the supplier name from the quote's tenant so the browser tab + share
  // preview reflect the actual reseller, not a hardcoded one.
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes").select("tenant_id").eq("id", params.id).maybeSingle();
  let supplier = "your reseller";
  if (quote?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants").select("name").eq("id", quote.tenant_id).maybeSingle();
    supplier = tenant?.name ?? supplier;
  }
  return {
    title: `Quote ${params.id} · Review & Accept`,
    description: `Review and accept your quote from ${supplier}.`,
    robots: "noindex",  // not search-engine indexable
  };
}

export default async function QuoteAcceptPage({ params }: Props) {
  const supabase = createAdminClient();

  // Fetch quote (admin client bypasses RLS — we trust the quote ID as the secret)
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !quote) {
    notFound();
  }

  // Don't expose draft quotes via public link — they're not meant for customer eyes
  if (quote.status === "draft") {
    notFound();
  }

  // Fetch tenant info for the brand header. Phone + address help the customer
  // contact the reseller before accepting (especially for India where WhatsApp
  // calls happen on the visible phone number).
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, gstin, email, phone, address")
    .eq("id", quote.tenant_id)
    .maybeSingle();

  // Mark quote as "viewed" if currently "sent" — fire and forget
  if (quote.status === "sent") {
    void supabase.from("quotes").update({ status: "viewed" }).eq("id", quote.id);
  }

  return (
    <QuoteAcceptView
      quote={quote as Quote}
      lineItems={(quote.line_items ?? []) as QuoteLineItem[]}
      tenantName={tenant?.name ?? "Reseller"}
      tenantGstin={tenant?.gstin ?? null}
      tenantEmail={tenant?.email ?? null}
      tenantPhone={tenant?.phone ?? null}
      tenantAddress={tenant?.address ?? null}
    />
  );
}

// Helper re-exports so the view can use them (could move to shared lib later)
export type { Quote, QuoteLineItem, LineCommitment };
