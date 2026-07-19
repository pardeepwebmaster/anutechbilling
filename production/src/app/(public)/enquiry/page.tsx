/**
 * Public shareable enquiry form — /enquiry
 *
 * A lightweight "tell us your requirement" form that anyone can open or embed
 * (?embed=1). On submit it POSTs to /api/public/enquiry/general which creates a
 * lead (source='enquiry-form') in the reseller's pipeline and emails both sides.
 *
 * This is the page the lead-gen "Public capture form" Share dialog points at.
 * Unlike /buy/workspace (a priced storefront), this is a simple contact/requirement
 * form — the reseller reads the requirement and follows up manually.
 *
 * Server-side we resolve the reseller's real business name from the `tenants`
 * table so the form is branded correctly (no hardcoded company name).
 */
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { EnquiryClient } from "./enquiry-client";

const BUY_PAGE_TENANT_ID =
  process.env.BUY_PAGE_TENANT_ID?.trim() || "fbb976f1-9090-4f10-9726-0901bd144e42";

export const metadata: Metadata = {
  title: "Get in touch · Send us your requirement",
  description: "Tell us what you need — Google Workspace, Microsoft 365, Zoho or something else — and we'll get back to you with a quote.",
};

export const dynamic = "force-dynamic";

async function fetchBrand(): Promise<{ name: string; phone: string | null }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("tenants")
      .select("name, phone")
      .eq("id", BUY_PAGE_TENANT_ID)
      .maybeSingle();
    return { name: data?.name ?? "Us", phone: data?.phone ?? null };
  } catch {
    return { name: "Us", phone: null };
  }
}

export default async function EnquiryPage() {
  const brand = await fetchBrand();
  return <EnquiryClient brandName={brand.name} brandPhone={brand.phone} />;
}
