/**
 * Server-side PDF prop builders — pure, so the /api/v1 document PDF routes
 * render the SAME invoice/quote the app shows. The amount math mirrors the
 * invoice detail page + quote detail page EXACTLY (don't diverge — a GST
 * invoice PDF is money-code):
 *
 *   discount = round(subtotal × discountPct/100)
 *   taxable  = subtotal − discount
 *   tax      = round(taxable × taxRate/100)
 *   total    = quote.amount (authoritative gross) — falls back to taxable+tax
 *
 * interState (GST head) uses the shared place-of-supply helper.
 */
import { isInterStateSupply } from "../gst/place-of-supply";
import type { Invoice, Quote, Customer } from "@/lib/supabase/database.types";
import type { InvoicePDFProps } from "./InvoicePDF";
import type { QuotePDFProps } from "./QuotePDF";

/** Supplier fields needed on both PDFs (from the tenants row). */
export interface TenantPdfInfo {
  name:        string;
  gstin:       string | null;
  email:       string | null;
  phone:       string | null;
  address:     string | null;
  state:       string | null;
  state_code:  string | null;
}

interface Amounts {
  subtotal: number; discountPct: number; discount: number;
  taxable: number; taxRate: number; tax: number; total: number;
}

/** Derive the breakdown from a quote (same rounding as the app's detail pages). */
export function quoteAmounts(quote: Pick<Quote, "subtotal" | "discount_pct" | "tax_rate" | "amount">): Amounts {
  const subtotal    = quote.subtotal ?? 0;
  const discountPct = quote.discount_pct ?? 0;
  const discount    = Math.round(subtotal * (discountPct / 100));
  const taxable     = subtotal - discount;
  const taxRate     = quote.tax_rate ?? 18;
  const tax         = Math.round(taxable * (taxRate / 100));
  const total       = quote.amount ?? (taxable + tax);
  return { subtotal, discountPct, discount, taxable, taxRate, tax, total };
}

export function buildInvoicePdfProps(args: {
  invoice:  Invoice;
  quote:    Quote | null;
  customer: Customer | null;
  tenant:   TenantPdfInfo;
}): InvoicePDFProps {
  const { invoice, quote, customer, tenant } = args;
  const a: Amounts = quote
    ? quoteAmounts(quote)
    : { subtotal: invoice.amount, discountPct: 0, discount: 0, taxable: invoice.amount, taxRate: 18, tax: 0, total: invoice.amount };
  // The invoice's authoritative gross wins for total/subtotal fallbacks (mirrors
  // the invoice detail page: total = quote?.amount ?? invoice.amount).
  const total    = quote?.amount   ?? invoice.amount;
  const subtotal = quote?.subtotal ?? invoice.amount;

  return {
    invoice,
    lineItems:   quote?.line_items ?? [],
    subtotal,
    discountPct: a.discountPct,
    discount:    a.discount,
    taxable:     a.taxable,
    taxRate:     a.taxRate,
    tax:         a.tax,
    total,
    interState:  isInterStateSupply(customer?.state_code, tenant.state_code),
    customerGstin:   customer?.gstin ?? null,
    customerEmail:   customer?.contact_email ?? null,
    customerAddress: customer?.address ?? null,
    customerState:   customer?.state ?? null,
    tenantName:    tenant.name,
    tenantGstin:   tenant.gstin,
    tenantEmail:   tenant.email,
    tenantPhone:   tenant.phone,
    tenantAddress: tenant.address,
    tenantState:   tenant.state,
  };
}

export function buildQuotePdfProps(args: {
  quote:    Quote;
  customer: Customer | null;
  tenant:   TenantPdfInfo;
}): QuotePDFProps {
  const { quote, customer, tenant } = args;
  const a = quoteAmounts(quote);
  const validityDays =
    quote.created_date && quote.expires_date
      ? Math.max(0, Math.round((new Date(quote.expires_date).getTime() - new Date(quote.created_date).getTime()) / 86_400_000))
      : 14;

  return {
    tenantName:    tenant.name,
    tenantGstin:   tenant.gstin,
    tenantEmail:   tenant.email,
    tenantPhone:   tenant.phone,
    tenantAddress: tenant.address,
    quoteId:       quote.id,
    customerName:  quote.customer_name,
    contactName:   customer?.contact_name ?? null,
    contactEmail:  customer?.contact_email ?? null,
    contactPhone:  customer?.contact_phone ?? null,
    createdDate:   quote.created_date,
    expiresDate:   quote.expires_date,
    validityDays,
    lineItems:     quote.line_items ?? [],
    subtotal:      a.subtotal,
    discountPct:   a.discountPct,
    discount:      a.discount,
    taxable:       a.taxable,
    taxRate:       a.taxRate,
    tax:           a.tax,
    total:         a.total,
    interState:    isInterStateSupply(customer?.state_code, tenant.state_code),
    notes:         quote.notes ?? undefined,
    isRenewal:     quote.is_renewal,
  };
}
