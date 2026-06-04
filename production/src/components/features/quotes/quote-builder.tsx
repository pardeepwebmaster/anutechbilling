/**
 * QuoteBuilder — clean redesign matching prototype pattern.
 *
 * Layout:
 *   - Page head with quote ID + serif title + action buttons
 *   - 2-col cards: Customer Details | Quote Settings
 *   - Line Items card: header with "Add item" button → opens modal
 *     - Table: Description / HSN / Qty (inline editable) / Rate / Amount / [delete]
 *     - Totals sidebar (right) inside same card: subtotal / discount / tax / grand total
 *   - Bottom action row: Duplicate / Email / WhatsApp / Finalize
 */
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarginPill, computeMargin } from "@/components/features/margin-pill";
import { GeminiCard } from "@/components/shared/gemini-card";
import { AddLineItemDialog } from "@/components/features/quotes/add-line-item-dialog";
import { QuotePreviewDialog } from "@/components/features/quotes/quote-preview-dialog";
import { useCustomers } from "@/lib/queries/customers";
import { useCreateQuote, useQuote } from "@/lib/queries/quotes";
import { useUpdateLead, useLeads } from "@/lib/queries/leads";
import { useItems } from "@/lib/queries/items";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { isInterStateSupply } from "@/lib/gst/place-of-supply";
import { addOrMergeLine } from "@/lib/quotes/line-items";
import { rupee, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { QuoteLineItem, LineCommitment } from "@/lib/supabase/database.types";

/** Number of invoices the customer receives per year for a given commitment */
function invoicesPerYear(c: LineCommitment): number {
  if (c === "annual_yearly")       return 1;
  if (c === "annual_half_yearly")  return 2;
  if (c === "annual_quarterly")    return 4;
  return 12; // monthly or annual_monthly
}

/** Per-invoice unit label (e.g., "/mo", "/qtr", "/half-yr", "/yr") */
function billingUnitLabel(c: LineCommitment): string {
  if (c === "annual_yearly")       return "/yr";
  if (c === "annual_half_yearly")  return "/half-yr";
  if (c === "annual_quarterly")    return "/qtr";
  return "/mo";
}

/** Whether this commitment is part of an annual contract (true for all except flex monthly) */
function isAnnualCommit(c: LineCommitment): boolean {
  return c !== "monthly";
}

// Quote IDs are allocated at SAVE time via the central document-numbering RPC
// (see migration 0004_document_series.sql) — this guarantees sequential per-tenant
// per-fiscal-year numbering, race-safe, and no wasted numbers from abandoned drafts.
// Before save, the UI shows a placeholder.

// Plan → monthly price per seat (same map used in Add Lead form).
// Cost approximated at 70% of rate (≈30% reseller margin); user can edit per line.
const PLAN_PRICE_PER_SEAT_PM: Record<string, number> = {
  "Google Workspace Business Starter": 136,
  "Google Workspace Standard":         736,
  "Google Workspace Plus":            1380,
  "Google Workspace Enterprise":      2000,
  "Microsoft 365 Business Basic":      145,
  "Microsoft 365 Business Standard":   735,
  "Microsoft 365 Business Premium":   1470,
  "Zoho Workplace Standard":           105,
  "Zoho Workplace Professional":       315,
  "Plus + Voice add-on":              1800,
};

export function QuoteBuilder() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: catalog } = useItems();
  const { data: currentUser } = useCurrentUser();
  const createQuote     = useCreateQuote();
  const updateLead = useUpdateLead();

  // Lead pre-fill context (when navigated from Lead Detail → Send Quote).
  // When leadId is present, we're in "lead mode" — quote belongs to a prospect,
  // not a paying customer. Customer record will be created only after payment.
  //
  // Accept both `?lead=` (short, easier for operators to type/share) and
  // `?leadId=` (legacy, built by lead drawer Send Quote button).
  const leadId      = searchParams.get("leadId") || searchParams.get("lead");
  // The lead drawer "Send Quote" button supplies these chained params for
  // instant prefill without a network round-trip. We also support the
  // shortcut form (`?lead=L-XXX` alone) by falling back to a useLeads()
  // lookup below.
  const urlCompany  = searchParams.get("company");
  const urlPlan     = searchParams.get("plan");
  const urlSeats    = searchParams.get("seats");
  const urlContact  = searchParams.get("contact");
  const urlEmail    = searchParams.get("email");
  const urlPhone    = searchParams.get("phone");
  // Duplicate / revise an existing quote ("edit & resend" workflow)
  const duplicateOf       = searchParams.get("duplicate");
  const urlCustomer       = searchParams.get("customer");  // Customer 360 → "Add service"
  const { data: sourceQuote } = useQuote(duplicateOf ?? undefined);

  // Look up the lead from the cached useLeads() query so the operator can
  // navigate to /quotes/new?lead=L-XXX with JUST the ID — we fill in the
  // rest from the lead row. This makes the URL bookmarkable / shareable
  // and unblocks the "type URL" workflow that was hitting "No customers yet".
  const { data: allLeads } = useLeads();
  const leadFromQuery = React.useMemo(() => {
    if (!leadId || !allLeads) return null;
    return allLeads.find((l) => l.id === leadId) ?? null;
  }, [leadId, allLeads]);

  // Effective lead fields — URL param wins, lead row fills in the rest.
  // Stays null until the lead has loaded OR all URL params are present.
  const leadCompanyInit = urlCompany || leadFromQuery?.company || "";
  const leadPlan        = urlPlan    || leadFromQuery?.plan    || null;
  const leadSeats       = urlSeats   || (leadFromQuery?.seats != null ? String(leadFromQuery.seats) : null);
  const leadContactInit = urlContact || leadFromQuery?.contact_name  || "";
  const leadEmailInit   = urlEmail   || leadFromQuery?.contact_email || "";
  const leadPhoneInit   = urlPhone   || leadFromQuery?.contact_phone || "";

  // Editable prospect detail state — initial values from lead row; user
  // can refine inline on the quote builder, and changes flow back to the
  // lead row on save. This was previously read-only; operators repeatedly
  // hit the wall of "phone/email blank, can't fill it here" and had to
  // bounce to /leads → edit → return. Inline edit collapses that loop.
  const [leadCompany, setLeadCompany] = React.useState(leadCompanyInit);
  const [leadContact, setLeadContact] = React.useState(leadContactInit);
  const [leadPhone,   setLeadPhone]   = React.useState(leadPhoneInit);
  const [leadEmail,   setLeadEmail]   = React.useState(leadEmailInit);

  // Sync local state when the lead loads asynchronously (initial mount the
  // values are empty strings; once allLeads arrives they get populated).
  React.useEffect(() => { if (leadCompanyInit) setLeadCompany(leadCompanyInit); }, [leadCompanyInit]);
  React.useEffect(() => { if (leadContactInit) setLeadContact(leadContactInit); }, [leadContactInit]);
  React.useEffect(() => { if (leadPhoneInit)   setLeadPhone(leadPhoneInit);     }, [leadPhoneInit]);
  React.useEffect(() => { if (leadEmailInit)   setLeadEmail(leadEmailInit);     }, [leadEmailInit]);

  // Lead mode applies when either:
  //   - explicit leadId in URL (from Lead Detail → Send Quote OR direct URL), OR
  //   - duplicating an existing prospect-only quote (source has lead_id, no customer_id)
  const isLeadMode = Boolean(
    leadId || (sourceQuote && sourceQuote.lead_id && !sourceQuote.customer_id),
  );

  // Form state
  const [customerId, setCustomerId] = React.useState<string>("");
  // Free-text prospect name — used when the operator wants to quote a NEW
  // prospect who isn't yet in the customers table. customer_id stays null;
  // the typed name is saved as quote.customer_name. A real customer record
  // gets created later when record_payment fires (lead → customer cascade).
  // This unblocks the "no customers yet" dead-end the picker had.
  const [prospectName, setProspectName] = React.useState<string>("");
  const [validityDays, setValidityDays] = React.useState(30);
  const [discountPct, setDiscountPct] = React.useState(0);
  const [taxRate, setTaxRate] = React.useState(18);
  const [notes, setNotes] = React.useState("");
  const [lineItems, setLineItems] = React.useState<QuoteLineItem[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  // Quote ID is allocated at SAVE time via the central numbering RPC.
  // null = unassigned (shown as placeholder in header until save).
  const [quoteId, setQuoteId] = React.useState<string | null>(null);

  // ── Pre-fill from lead (runs once — waits for catalog so we use real prices) ──
  const prefilledRef = React.useRef(false);
  React.useEffect(() => {
    if (prefilledRef.current) return;
    if (!isLeadMode || !leadCompany) return;
    // Wait for catalog to load — so we can use the tenant's actual prices,
    // not the hardcoded fallback map.
    if (!catalog) return;

    prefilledRef.current = true;

    const seatsNum = leadSeats ? parseInt(leadSeats, 10) : 0;

    // 1. Find the matching catalog item — tries exact / substring / tier-keyword.
    //    Normalize hyphens to spaces because lead plans coming from the buy
    //    page are stored as slugs like "google-workspace-standard" while
    //    catalog item names use spaces ("Google Workspace Standard").
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    const target = leadPlan ? normalize(leadPlan) : "";

    let catalogItem = target
      ? catalog.find((c) => normalize(c.name) === target)
      : undefined;

    if (!catalogItem && target) {
      // Substring match: normalized catalog name contains the lead's plan keyword (or vice versa)
      catalogItem = catalog.find((c) => {
        const n = normalize(c.name);
        return n.includes(target) || target.includes(n);
      });
    }

    if (!catalogItem && target) {
      // Last-resort: pluck out a tier keyword ("starter" / "standard" / "plus" /
      // "enterprise") from the lead plan and find a catalog item containing it.
      // Handles slugs like "google-workspace-standard" cleanly.
      const TIER_KEYWORDS = ["enterprise", "plus", "standard", "starter"];
      const tierWord = TIER_KEYWORDS.find((k) => target.includes(k));
      if (tierWord) {
        catalogItem = catalog.find((c) => normalize(c.name).includes(tierWord));
      }
    }

    let rate = 0;
    let cost = 0;
    let source: "catalog" | "fallback" | "" = "";

    if (catalogItem) {
      // Use the actual catalog pricing — annual tier × 12 = ₹/seat/yr
      const annualPerMonth = catalogItem.prices?.annual ?? catalogItem.prices?.monthly;
      if (annualPerMonth && annualPerMonth.msrp > 0) {
        rate   = annualPerMonth.msrp * 12;
        cost   = annualPerMonth.wholesale * 12;
        source = "catalog";
      } else if (catalogItem.msrp > 0) {
        // Legacy: use msrp/wholesale columns directly (assumed ₹/seat/month)
        rate   = catalogItem.msrp * 12;
        cost   = catalogItem.wholesale * 12;
        source = "catalog";
      }
    }

    // 2. Fallback to hardcoded plan map — tries exact then substring match too.
    if (!rate && leadPlan) {
      const lpLower = leadPlan.toLowerCase();
      let monthlyPPS = PLAN_PRICE_PER_SEAT_PM[leadPlan];
      if (!monthlyPPS) {
        // Try substring match against known plan names
        const key = Object.keys(PLAN_PRICE_PER_SEAT_PM).find((k) => {
          const kl = k.toLowerCase();
          return kl.includes(lpLower) || lpLower.includes(kl);
        });
        if (key) monthlyPPS = PLAN_PRICE_PER_SEAT_PM[key];
      }
      if (monthlyPPS) {
        rate   = monthlyPPS * 12;
        cost   = Math.round(rate * 0.7);
        source = "fallback";
      }
    }

    if (leadPlan && seatsNum > 0 && rate > 0) {
      setLineItems([
        {
          id:         `line-${Date.now()}`,
          item_id:    catalogItem?.id,
          // Use the full catalog name when matched (so "Starter" → "Google Workspace Business Starter")
          name:       catalogItem?.name ?? leadPlan,
          qty:        seatsNum,
          rate,
          cost,
          commitment: "annual_yearly",
        },
      ]);
      toast.success(
        source === "catalog"
          ? `Pre-filled from catalog: ${seatsNum} × ${leadPlan} @ ₹${rate}/seat/yr`
          : `Pre-filled (catalog item missing — using fallback): ${seatsNum} × ${leadPlan} @ ₹${rate}/seat/yr`,
      );
    } else {
      toast.info(`Add line items for ${leadCompany}'s quote`);
    }

    // Pre-fill notes with friendly customer-facing message
    setNotes(
      `Quote for ${leadCompany}\n` +
      (leadContact ? `Attn: ${leadContact}\n` : "") +
      `\nPricing valid for 30 days. Onboarding includes DNS, MX, SPF, DKIM, DMARC setup. Free training (2 sessions).`,
    );
  }, [isLeadMode, leadCompany, leadPlan, leadSeats, leadContact, catalog]);

  // ── Pre-fill from existing quote (Duplicate / Revise & resend) ──
  const duplicatedRef = React.useRef(false);
  React.useEffect(() => {
    if (duplicatedRef.current) return;
    if (!duplicateOf || !sourceQuote) return;

    duplicatedRef.current = true;

    // Copy customer / lead linkage from source
    if (sourceQuote.customer_id) {
      setCustomerId(sourceQuote.customer_id);
    }
    // Copy line items + financial settings
    if (Array.isArray(sourceQuote.line_items)) {
      // Clone with fresh IDs so React keys stay unique if source items get edited
      const items = (sourceQuote.line_items as QuoteLineItem[]).map((l, i) => ({
        ...l,
        id: `line-${Date.now()}-${i}`,
      }));
      setLineItems(items);
    }
    if (sourceQuote.discount_pct != null) setDiscountPct(sourceQuote.discount_pct);
    if (sourceQuote.tax_rate     != null) setTaxRate(sourceQuote.tax_rate);
    if (sourceQuote.notes)                setNotes(sourceQuote.notes);

    toast.success(`Revising ${sourceQuote.id} — edit anything, then Save & send`);
  }, [duplicateOf, sourceQuote]);

  // ── Pre-fill the customer from ?customer=<id> (Customer 360 → "Add service") ──
  // Mirrors the ?lead= path but for an EXISTING customer (cross-sell / new service).
  const presetCustRef = React.useRef(false);
  React.useEffect(() => {
    if (presetCustRef.current || !urlCustomer || !customers) return;
    if (customers.some((c) => c.id === urlCustomer)) {
      presetCustRef.current = true;
      setCustomerId(urlCustomer);
      setProspectName("");
    }
  }, [urlCustomer, customers]);

  // Derived customer fields
  const customer = customers?.find((c) => c.id === customerId);
  // GST head: compare the customer's state vs OUR (the seller/tenant's) state.
  // Previously hardcoded a seller of "27" (Maharashtra), which was wrong for any
  // other tenant. Now derived consistently via the shared helper. (audit #18-20)
  const interState = isInterStateSupply(customer?.state_code, currentUser?.tenantStateCode);

  // Per-line gross before any discount (list price × qty)
  const grossSubtotal     = lineItems.reduce((s, it) => s + it.qty * it.rate, 0);
  // Per-line discount sum (each line's discount_pct applied to its gross)
  const lineDiscountTotal = lineItems.reduce((s, it) => s + Math.round(it.qty * it.rate * ((it.discount_pct ?? 0) / 100)), 0);
  // Subtotal = gross minus per-line discounts (this is what quote-level discount applies on)
  const subtotal          = grossSubtotal - lineDiscountTotal;
  const totalCost         = lineItems.reduce((s, it) => s + it.qty * it.cost, 0);
  // Quote-level discount on top of per-line discounts
  const discount          = Math.round(subtotal * (discountPct / 100));
  const taxable           = subtotal - discount;
  const tax               = Math.round(taxable * (taxRate / 100));
  const total             = taxable + tax;
  const margin            = computeMargin(totalCost, taxable);

  // Billing-cycle display: if EVERY line item shares the same billing term, show
  // totals in that per-invoice unit (with the annual amount as a small hint).
  // Mixed billing cycles → totals stay annual.
  const firstCommitment = (lineItems[0]?.commitment ?? "annual_yearly") as LineCommitment;
  const sharedBilling =
    lineItems.length > 0 &&
    lineItems.every(
      (l) => invoicesPerYear(l.commitment ?? "annual_yearly") === invoicesPerYear(firstCommitment),
    );
  const sharedBillingN     = sharedBilling ? invoicesPerYear(firstCommitment) : 1;
  const sharedBillingUnit  = sharedBilling ? billingUnitLabel(firstCommitment) : "";
  const showPerInvoice     = sharedBilling && sharedBillingN > 1;
  const totalsLabel        =
    !sharedBilling                 ? "Subtotal (annual)"           :
    sharedBillingN === 12          ? "Subtotal (monthly recurring)" :
    sharedBillingN === 4           ? "Subtotal (quarterly)"         :
    sharedBillingN === 2           ? "Subtotal (half-yearly)"       :
    "Subtotal (annual)";
  const fmtTotal = (n: number) =>
    showPerInvoice
      ? rupee(Math.round(n / sharedBillingN)) + sharedBillingUnit
      : rupee(n);

  // Line item handlers
  const addLine = (line: QuoteLineItem) => {
    // Merge into an economically-identical existing line instead of creating a
    // duplicate row (which silently doubles the quote total). (audit: dup-line)
    const { lines, merged, mergedQty } = addOrMergeLine(lineItems, line);
    setLineItems(lines);
    toast.success(
      merged
        ? `${line.name} already in this quote — quantity increased to ${mergedQty}`
        : `Added ${line.name}`,
    );
  };
  const updateQty = (id: string, qty: number) => {
    setLineItems((s) => s.map((l) => (l.id === id ? { ...l, qty: Math.max(1, qty) } : l)));
  };
  const updateRate = (id: string, rate: number) => {
    setLineItems((s) => s.map((l) => (l.id === id ? { ...l, rate: Math.max(0, rate) } : l)));
  };
  const updateCost = (id: string, cost: number) => {
    setLineItems((s) => s.map((l) => (l.id === id ? { ...l, cost: Math.max(0, cost) } : l)));
  };
  /** Per-line reseller discount (0–50%). Comes out of margin, not from Google wholesale. */
  const updateDiscount = (id: string, pct: number) => {
    const clamped = Math.max(0, Math.min(50, pct));
    setLineItems((s) => s.map((l) => (l.id === id ? { ...l, discount_pct: clamped || undefined } : l)));
  };
  const updateDiscountReason = (id: string, reason: string) => {
    setLineItems((s) => s.map((l) => (l.id === id ? { ...l, discount_reason: reason.trim() || undefined } : l)));
  };
  const updateCommitment = (id: string, commitment: LineCommitment) => {
    setLineItems((s) =>
      s.map((l) => {
        if (l.id !== id) return l;

        // If this line came from the catalog, recalc rate based on new commitment tier
        if (l.item_id && catalog) {
          const item = catalog.find((c) => c.id === l.item_id);
          // Map line commitment → underlying item price tier
          // "monthly" = monthly flex tier · others = annual tier (same price, only billing differs)
          const tierKey = commitment === "monthly" ? "monthly" : "annual";
          const tier    = item?.prices?.[tierKey];
          if (tier && tier.msrp > 0) {
            return {
              ...l,
              commitment,
              rate: tier.msrp * 12,        // store as ₹/seat/year
              cost: tier.wholesale * 12,
            };
          }
        }
        // No catalog link OR tier not found — just update commitment, keep current rate
        return { ...l, commitment };
      }),
    );
  };
  const removeLine = (id: string) => {
    setLineItems((s) => s.filter((l) => l.id !== id));
  };

  // Submit
  // afterAction lets the caller request a follow-up on the detail page
  // (open the email or WhatsApp dialog as soon as we land). The detail
  // page reads `?send=whatsapp` / `?send=email` from the URL.
  const handleSubmit = async (status: "draft" | "sent", afterAction?: "email" | "whatsapp") => {
    // In lead mode, customer is NOT required (lead = potential customer).
    // A real customer record gets created only after payment.
    // In customer mode, accept EITHER an existing customer pick OR a typed
    // prospect name — prospect mode lets the operator quote a brand-new
    // company without first creating a customer record.
    if (!isLeadMode && !customerId && !prospectName.trim()) {
      toast.error("Pick a customer or type a new prospect name");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }

    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + validityDays);

    try {
      // Allocate the sequential quote ID via the central numbering RPC.
      // Reuse if user clicked save twice (e.g., draft → send) — don't waste numbers.
      let idToUse = quoteId;
      if (!idToUse) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: newId, error: seqErr } = await supabase
          .rpc("next_document_number", { p_doc_type: "quote" });
        if (seqErr || !newId) {
          toast.error("Failed to allocate quote number — please retry");
          return;
        }
        idToUse = newId;
        setQuoteId(newId);
      }

      // Resolve customer_name: lead → use lead.company. Else if customerId
      // picked → use that customer's name. Else (prospect mode) → use typed
      // prospect name. Validation upstream ensures one of these is present.
      const resolvedCustomerName = isLeadMode
        ? (leadCompany ?? "Prospect")
        : customer
          ? customer.name
          : (prospectName.trim() || "Prospect");

      const quote = await createQuote.mutateAsync({
        id: idToUse,
        customer_id:   isLeadMode ? null : (customerId || null),
        customer_name: resolvedCustomerName,
        lead_id:       isLeadMode ? leadId : null,
        line_items:    lineItems,
        subtotal,
        total_cost:    totalCost,
        discount_pct:  discountPct,
        tax_rate:      taxRate,
        amount:        total,
        status,
        notes:         notes || null,
        expires_date:  expiresDate.toISOString().slice(0, 10),
        seats:         lineItems.reduce((s, l) => s + l.qty, 0),
        plan:          lineItems[0]?.name ?? null,
      });

      // If created from a lead AND quote actually went out (not just saved as
      // draft), graduate the lead from "raw" (Leads tab) to "qualified"
      // (Deals tab) AND advance its stage to "quote". We pull plan/seats/value
      // from the just-sent quote so the lead row reflects what the customer
      // is actually being quoted — otherwise a raw lead would end up in
      // stage='quote' with plan=NULL, looking like a Quote Sent lead in the
      // Leads (raw) tab forever.
      if (isLeadMode && leadId && status === "sent") {
        try {
          const totalSeats = lineItems.reduce((s, l) => s + l.qty, 0);
          await updateLead.mutateAsync({
            id: leadId,
            patch: {
              stage: "quote",
              plan:  lineItems[0]?.name ?? null,
              seats: totalSeats > 0 ? totalSeats : null,
              value: total > 0     ? total     : null,
              // Sync the edited contact info back to the lead row — single
              // source of truth lives on the lead. company is NOT NULL on
              // the DB so we only patch when the new value is non-empty;
              // contact_* fields are nullable so we patch with null when
              // user clears them.
              ...(leadCompany !== leadCompanyInit && leadCompany.trim() && { company:       leadCompany.trim()    }),
              ...(leadContact !== leadContactInit                       && { contact_name:  leadContact || null   }),
              ...(leadPhone   !== leadPhoneInit                         && { contact_phone: leadPhone   || null   }),
              ...(leadEmail   !== leadEmailInit                         && { contact_email: leadEmail   || null   }),
            },
          });
          toast.success(`Lead moved to "Quote Sent" · qualified`);
        } catch {
          // Don't block the redirect if stage update fails; quote is saved.
        }
      } else if (isLeadMode && leadId && status === "draft") {
        // For drafts: still persist contact-info edits to the lead so they
        // don't get lost when the user comes back. Stage stays as-is.
        const contactPatch = {
          ...(leadCompany !== leadCompanyInit && leadCompany.trim() && { company:       leadCompany.trim()  }),
          ...(leadContact !== leadContactInit                       && { contact_name:  leadContact || null }),
          ...(leadPhone   !== leadPhoneInit                         && { contact_phone: leadPhone   || null }),
          ...(leadEmail   !== leadEmailInit                         && { contact_email: leadEmail   || null }),
        };
        if (Object.keys(contactPatch).length > 0) {
          try {
            await updateLead.mutateAsync({ id: leadId, patch: contactPatch });
          } catch {
            /* don't block redirect */
          }
        }
      }

      const suffix = afterAction ? `?send=${afterAction}` : "";
      router.push(`/quotes/${quote.id}${suffix}` as any);
    } catch {
      // toast in hook
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto space-y-4">
      {/* Page head */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <IconButton icon="arrow_left" aria-label="Back" onClick={() => router.back()} />
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">
              Quotation · Auto-generated
            </p>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">
              {quoteId ?? <span className="text-ink-3">Q-…-…-…</span>}
            </h1>
            <p className="text-sm text-ink-3 mt-1">
              For <b className="text-ink">{isLeadMode ? leadCompany : (customer?.name ?? prospectName.trim() ?? "—")}</b>
              {(isLeadMode || (!customer && prospectName.trim())) && (
                <span className="ml-1 text-amber-ink">(prospect)</span>
              )}
              {" · Draft"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="copy" variant="ghost" onClick={() => handleSubmit("draft")} loading={createQuote.isPending}>
            Save draft
          </Button>
          <Button
            icon="file"
            onClick={() => {
              if (lineItems.length === 0) {
                toast.error("Add at least one line item to preview");
                return;
              }
              setPreviewOpen(true);
            }}
          >
            Preview
          </Button>
          <Button
            icon="send"
            variant="primary"
            onClick={() => handleSubmit("sent")}
            loading={createQuote.isPending}
            disabled={(!isLeadMode && !customerId && !prospectName.trim()) || lineItems.length === 0}
          >
            Save & send
          </Button>
        </div>
      </div>

      {/* AI margin warning */}
      {lineItems.length > 0 && margin.marginPct < 14 && (
        <GeminiCard title="Margin alert" compact>
          <b>Margin below 14% ({margin.marginPct}%).</b> Consider reducing discount or upselling higher-tier products.
        </GeminiCard>
      )}

      {/* Top: 2-col cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLeadMode ? (
          /* ───── Prospect Details (read-only, from lead) ───── */
          <Card title="Prospect Details">
            <div className="space-y-3">
              <div className="rounded-md bg-amber-soft border border-amber/40 px-3 py-2 text-xs text-amber-ink flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <div>
                  <b>Potential customer</b> — full customer record will be created
                  automatically once payment is received.
                </div>
              </div>

              <FormField label="Company" htmlFor="leadCompany">
                <Input
                  id="leadCompany"
                  value={leadCompany}
                  onChange={(e) => setLeadCompany(e.target.value)}
                  className="font-medium"
                  placeholder="Company name"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Contact name" htmlFor="leadContact">
                  <Input
                    id="leadContact"
                    value={leadContact}
                    onChange={(e) => setLeadContact(e.target.value)}
                    placeholder="Contact person"
                  />
                </FormField>
                <FormField label="Phone" htmlFor="leadPhone">
                  <Input
                    id="leadPhone"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    className="font-mono"
                    placeholder="+91 98765 43210"
                  />
                </FormField>
              </div>

              <FormField label="Email" htmlFor="leadEmail">
                <Input
                  id="leadEmail"
                  type="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="font-mono"
                  placeholder="contact@company.com"
                />
              </FormField>

              <div className="flex gap-2 text-[11px] text-ink-3 pt-1 border-t border-hairline">
                <span>Lead ID: <code className="font-mono">{leadId}</code></span>
                {leadPlan && <span>· Interested in: <b>{leadPlan}</b></span>}
                {leadSeats && <span>· {leadSeats} seats</span>}
              </div>
            </div>
          </Card>
        ) : (
          /* ───── Customer Details (existing customer OR new prospect flow) ───── */
          <Card title="Customer Details">
            <div className="space-y-3">
              <FormField label="Existing customer" htmlFor="customer">
                {customersLoading ? (
                  <Skeleton className="h-9" />
                ) : customers && customers.length > 0 ? (
                  <Select
                    value={customerId}
                    onValueChange={(v) => {
                      setCustomerId(v);
                      // Picking an existing customer clears the prospect name
                      // so there's a single source of truth.
                      if (v) setProspectName("");
                    }}
                  >
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="Pick a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-ink-3 italic px-1 py-2">
                    No saved customers yet — type a new prospect below.
                  </p>
                )}
              </FormField>

              {/* Free-text prospect entry — works WITH or WITHOUT existing customers.
                  Operator can quote a brand-new company without first creating a
                  customer record. customer_id stays null on this quote; a real
                  customer auto-creates on first payment (record_payment RPC). */}
              <FormField
                label={customers && customers.length > 0 ? "Or type a new prospect" : "Prospect name"}
                required={!customerId}
                htmlFor="prospectName"
              >
                <Input
                  id="prospectName"
                  placeholder="Acme Corp Pvt Ltd"
                  value={prospectName}
                  onChange={(e) => {
                    setProspectName(e.target.value);
                    // Typing clears the customer pick — single source of truth.
                    if (e.target.value && customerId) setCustomerId("");
                  }}
                />
                <p className="text-[10px] text-ink-3 mt-1">
                  Use this for new prospects who haven&apos;t made a payment yet.
                  We&apos;ll auto-create the customer record when they pay.
                </p>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Domain" htmlFor="domain">
                  <Input
                    id="domain"
                    value={customer?.domain ?? ""}
                    readOnly
                    className="bg-paper-2 cursor-default"
                    placeholder="—"
                  />
                </FormField>
                <FormField label="GSTIN" htmlFor="gstin">
                  <Input
                    id="gstin"
                    value={customer?.gstin ?? ""}
                    readOnly
                    className="bg-paper-2 cursor-default font-mono"
                    placeholder="—"
                  />
                </FormField>
              </div>

              <FormField label="Place of supply" htmlFor="state">
                <Input
                  id="state"
                  value={customer?.state ?? ""}
                  readOnly
                  className="bg-paper-2 cursor-default"
                  placeholder="—"
                />
                {customer && (
                  <p className="text-[11px] mt-1 flex items-center gap-1">
                    {interState ? (
                      <span className="text-amber-ink">⚠ Inter-state → IGST {taxRate}% will apply</span>
                    ) : (
                      <span className="text-emerald">✓ Intra-state → CGST + SGST split</span>
                    )}
                  </p>
                )}
              </FormField>
            </div>
          </Card>
        )}

        {/* Quote Settings */}
        <Card title="Quote Settings">
          <div className="space-y-3">

            {/* Billing cycle — prominent quote-level picker.
                Indian SME customers overwhelmingly prefer ANNUAL UPFRONT.
                This picker syncs all line items in one click; per-line
                override still works inside the line items table. */}
            <div>
              <label className="text-xs font-medium text-ink-3 mb-1.5 block">Billing cycle</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "yearly",     label: "Annual",    sub: "1 invoice/yr",   pop: true },
                  { id: "quarterly",  label: "Quarterly", sub: "4 invoices/yr",  pop: false },
                  { id: "monthly",    label: "Monthly",   sub: "12 invoices",    pop: false },
                ].map((opt) => {
                  // Determine if this option matches all current line items
                  const matches = lineItems.length > 0 && lineItems.every((l) => {
                    const c = l.commitment ?? "annual_yearly";
                    if (opt.id === "yearly")    return c === "annual_yearly";
                    if (opt.id === "quarterly") return c === "annual_quarterly";
                    if (opt.id === "monthly")   return c === "annual_monthly" || c === "monthly";
                    return false;
                  });
                  const applyToAll = () => {
                    const target: LineCommitment =
                      opt.id === "yearly"    ? "annual_yearly"   :
                      opt.id === "quarterly" ? "annual_quarterly":
                      "annual_monthly";
                    setLineItems((prev) => prev.map((l) => ({ ...l, commitment: target })));
                  };
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={applyToAll}
                      disabled={lineItems.length === 0}
                      className={cn(
                        "relative rounded-md border px-2 py-2.5 text-left transition-all",
                        matches
                          ? "border-amber bg-amber-soft/40 ring-1 ring-amber"
                          : "border-hairline bg-paper hover:border-amber-soft hover:bg-paper-2/50",
                        lineItems.length === 0 && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      {opt.pop && (
                        <span className="absolute -top-2 left-2 bg-amber text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Popular
                        </span>
                      )}
                      <div className="text-xs font-semibold text-ink">{opt.label}</div>
                      <div className="text-[10px] text-ink-3 mt-0.5">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-3">
                Most Indian customers prefer annual upfront. Per-line override available in the items table.
              </p>
            </div>

            <FormField label="Valid for (days)" htmlFor="validity">
              <Input
                id="validity"
                type="number"
                min={1}
                max={365}
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="Expires on" htmlFor="expires">
              <Input
                id="expires"
                value={formatDate(new Date(Date.now() + validityDays * 86400000))}
                readOnly
                className="bg-paper-2 cursor-default font-mono"
              />
            </FormField>

            <FormField label="GST rate %" htmlFor="taxRate">
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={28}
                suffix="%"
                value={taxRate}
                onChange={(e) => setTaxRate(parseInt(e.target.value) || 18)}
                helper="Default 18% for SaaS · HSN 998313"
              />
            </FormField>
          </div>
        </Card>
      </div>

      {/* Line Items card */}
      <Card flush>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-hairline">
          <div>
            <div className="text-sm font-semibold">Line Items</div>
            <div className="text-xs text-ink-3 mt-0.5">{lineItems.length} item{lineItems.length === 1 ? "" : "s"}</div>
          </div>
          <Button size="sm" icon="plus" onClick={() => setAddOpen(true)}>
            Add item
          </Button>
        </div>

        {/* Table */}
        {lineItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-soft to-paper-2 grid place-items-center text-amber ring-1 ring-hairline">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7.5 4.27 9 5.15M21 8 12 13 3 8M3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8M12 22V13" />
              </svg>
            </div>
            <div className="font-serif text-lg mb-1">No line items yet</div>
            <p className="text-sm text-ink-3 mb-4">Add products from your catalog or enter custom items.</p>
            <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
              Add first item
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Description</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-24">HSN</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-28">Qty</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-36">Rate</th>
                <th className="text-right p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider w-36">Amount</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line) => {
                // Per-line discount → effective net rate (used for actual margin)
                const lineDiscountPct = line.discount_pct ?? 0;
                const netRate         = line.rate * (1 - lineDiscountPct / 100);
                const lineMargin      = computeMargin(line.cost * line.qty, netRate * line.qty);

                // Display unit depends on commitment + billing term.
                // Storage is always ₹/seat/YEAR — divide by invoicesPerYear for display.
                const commitment  = line.commitment ?? "annual_yearly";
                const annualCommit = isAnnualCommit(commitment);
                const billingN    = invoicesPerYear(commitment);
                const unitLabel   = billingUnitLabel(commitment);
                const displayRate = Math.round(line.rate / billingN);
                const displayCost = Math.round(line.cost / billingN);
                const isPerInvoice = billingN > 1; // anything other than yearly invoice
                const lineGross   = line.qty * line.rate;
                const lineDiscount = Math.round(lineGross * (lineDiscountPct / 100));
                const lineNet     = lineGross - lineDiscount;

                // When user edits, convert back to annual for storage
                const handleRateChange = (raw: number) => updateRate(line.id, raw * billingN);
                const handleCostChange = (raw: number) => updateCost(line.id, raw * billingN);

                // For commitment+billing two-dropdown UI:
                //   Top-level type: "monthly" (flex) OR "annual" — derived from current
                const commitType: "monthly" | "annual" = commitment === "monthly" ? "monthly" : "annual";
                // Billing cycle (only relevant when annual)
                const billingCycle =
                  commitment === "annual_monthly"     ? "monthly"     :
                  commitment === "annual_quarterly"   ? "quarterly"   :
                  commitment === "annual_half_yearly" ? "half_yearly" :
                  "yearly";

                const handleCommitTypeChange = (t: "monthly" | "annual") => {
                  // Flipping to flex → "monthly"; flipping to annual → keep default annual_yearly
                  updateCommitment(line.id, t === "monthly" ? "monthly" : "annual_yearly");
                };
                const handleBillingChange = (b: string) => {
                  const next: LineCommitment =
                    b === "monthly"     ? "annual_monthly"     :
                    b === "quarterly"   ? "annual_quarterly"   :
                    b === "half_yearly" ? "annual_half_yearly" :
                    "annual_yearly";
                  updateCommitment(line.id, next);
                };

                return (
                  <tr key={line.id} className="border-b border-hairline last:border-0">
                    <td className="p-3">
                      <div className="font-medium text-sm text-ink">{line.name}</div>
                      <div className="text-[11px] text-ink-3 mt-0.5 tabular-nums flex items-center gap-1.5 flex-wrap">
                        <span>Cost ₹</span>
                        <input
                          type="number"
                          min={0}
                          value={displayCost}
                          onChange={(e) => handleCostChange(parseInt(e.target.value) || 0)}
                          className="w-16 px-1 py-0.5 text-[11px] text-right tabular-nums border border-hairline rounded bg-paper focus:outline-none focus:ring-1 focus:ring-amber focus:border-amber"
                        />
                        <span>/seat{unitLabel} · Margin {lineMargin.marginPct}%</span>
                      </div>
                      {/* Per-line reseller discount (B2B special pricing) — comes out of MY margin */}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="text-ink-3 font-medium">Disc</span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={1}
                          value={lineDiscountPct || ""}
                          placeholder="0"
                          onChange={(e) => updateDiscount(line.id, parseInt(e.target.value) || 0)}
                          className="w-12 px-1 py-0.5 text-[11px] text-right tabular-nums border border-hairline rounded bg-paper focus:outline-none focus:ring-1 focus:ring-amber focus:border-amber"
                        />
                        <span className="text-ink-3">%</span>
                        {lineDiscountPct > 0 && (
                          <>
                            <input
                              type="text"
                              value={line.discount_reason ?? ""}
                              placeholder="Reason (e.g., Loyalty)"
                              onChange={(e) => updateDiscountReason(line.id, e.target.value)}
                              className="flex-1 min-w-[100px] px-1.5 py-0.5 text-[11px] border border-hairline rounded bg-paper focus:outline-none focus:ring-1 focus:ring-amber focus:border-amber"
                            />
                            <span className="text-emerald font-medium tabular-nums">
                              −{rupee(lineDiscount)}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Commitment + billing-term selectors */}
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Commit</span>
                          <select
                            value={commitType}
                            onChange={(e) => handleCommitTypeChange(e.target.value as "monthly" | "annual")}
                            className="text-[11px] px-1.5 py-0.5 border border-hairline rounded bg-paper focus:outline-none focus:ring-1 focus:ring-amber focus:border-amber"
                          >
                            <option value="monthly">Monthly flex</option>
                            <option value="annual">Annual (1-yr)</option>
                          </select>
                        </div>
                        {annualCommit && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Bill</span>
                            <select
                              value={billingCycle}
                              onChange={(e) => handleBillingChange(e.target.value)}
                              className="text-[11px] px-1.5 py-0.5 border border-hairline rounded bg-paper focus:outline-none focus:ring-1 focus:ring-amber focus:border-amber"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="half_yearly">Half-yearly</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-xs font-mono text-ink-3">998313</td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(e) => updateQty(line.id, parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-sm text-right tabular-nums border border-hairline rounded bg-paper focus:outline-none focus:ring-2 focus:ring-amber focus:border-amber"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs text-ink-3">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={displayRate}
                          onChange={(e) => handleRateChange(parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm text-right tabular-nums border border-hairline rounded bg-paper focus:outline-none focus:ring-2 focus:ring-amber focus:border-amber"
                        />
                        <span className="text-[10px] text-ink-3 ml-0.5">{unitLabel}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums text-sm font-medium">
                      {isPerInvoice ? (
                        <>
                          {/* Per-invoice amount = what customer pays each billing cycle */}
                          <div>{rupee(line.qty * displayRate)}{unitLabel}</div>
                          <div className="text-[10px] text-ink-3 font-normal">
                            = {rupee(lineNet)}/yr
                            {lineDiscountPct > 0 && (
                              <span className="text-ink-3"> (was {rupee(lineGross)})</span>
                            )}
                          </div>
                        </>
                      ) : (
                        // Yearly bill — single annual invoice
                        <div>
                          {rupee(lineNet)}
                          {lineDiscountPct > 0 && (
                            <div className="text-[10px] text-ink-3 font-normal line-through">
                              {rupee(lineGross)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <IconButton
                        icon="trash"
                        aria-label="Remove line"
                        size="sm"
                        onClick={() => removeLine(line.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Totals + Notes — only when we have items */}
        {lineItems.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-4 border-t border-hairline">
            {/* Notes (left) */}
            <div>
              <label className="text-xs font-medium text-ink-2 block mb-1.5">Notes for customer</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Pricing valid for 30 days. Onboarding includes DNS, MX, SPF, DKIM, DMARC setup. Free training (2 sessions)."
                rows={6}
              />
              <p className="text-[11px] text-ink-3 mt-1">Shown on customer-facing quote PDF.</p>
            </div>

            {/* Totals (right) */}
            <div className="bg-paper-2 rounded-lg p-4 space-y-2.5 self-start">
              {/* Show gross + line-level discount aggregate when any line has discount */}
              {lineDiscountTotal > 0 && (
                <>
                  <TotalRow label="Gross (list price)" value={fmtTotal(grossSubtotal)} />
                  <div className="flex items-center justify-between text-sm text-emerald">
                    <span>Line discounts</span>
                    <span className="tabular-nums">−{fmtTotal(lineDiscountTotal)}</span>
                  </div>
                </>
              )}
              <TotalRow label={lineDiscountTotal > 0 ? `Subtotal (after line disc)` : totalsLabel} value={fmtTotal(subtotal)} />

              {/* Inline discount editor — quote-level (on top of per-line) */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-ink-3">
                  <span>Quote discount</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-14 px-1.5 py-0.5 text-xs text-right tabular-nums border border-hairline rounded bg-paper focus:outline-none focus:ring-2 focus:ring-amber focus:border-amber"
                  />
                  <span>%</span>
                </div>
                <span className="tabular-nums text-emerald">
                  {discount > 0
                    ? `−${showPerInvoice ? rupee(Math.round(discount / sharedBillingN)) + sharedBillingUnit : rupee(discount)}`
                    : "—"}
                </span>
              </div>

              <TotalRow label="Taxable amount" value={fmtTotal(taxable)} />

              <div className="text-[11px] text-ink-3 italic flex items-center gap-1 py-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                {interState ? `Different state → IGST applicable` : `Same state → CGST + SGST split`} @ {taxRate}%
              </div>

              {interState ? (
                <TotalRow label={`IGST (${taxRate}%)`} value={fmtTotal(tax)} />
              ) : (
                <>
                  <TotalRow label={`CGST (${taxRate / 2}%)`} value={fmtTotal(Math.round(tax / 2))} />
                  <TotalRow label={`SGST (${taxRate / 2}%)`} value={fmtTotal(tax - Math.round(tax / 2))} />
                </>
              )}

              {/* Grand total — emphasizes "Total payable now" for annual upfront */}
              <div className="border-t border-hairline-strong pt-3 mt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                    {/* When all lines are annual_yearly (single yearly invoice),
                        the customer pays the FULL amount upfront — Indian SME default. */}
                    {!showPerInvoice && sharedBillingN === 1
                      ? "Total payable now"
                      : "Grand total"}
                  </span>
                  <div className="text-right">
                    <span className="font-serif text-3xl text-amber tabular-nums">
                      {showPerInvoice
                        ? rupee(Math.round(total / sharedBillingN))
                        : rupee(total)}
                    </span>
                    {showPerInvoice && (
                      <div className="text-[11px] text-ink-3 font-normal mt-0.5">
                        per invoice ({sharedBillingN}/yr) · = {rupee(total)} / year
                      </div>
                    )}
                    {!showPerInvoice && sharedBillingN === 1 && (
                      <div className="text-[11px] text-emerald font-medium mt-0.5">
                        ✓ Single invoice · pay once for full year
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Margin pill */}
              <div className="pt-3 mt-2 border-t border-hairline flex items-center justify-between">
                <span className="text-xs text-ink-3 uppercase tracking-wider font-semibold">Your margin</span>
                <MarginPill margin={margin} variant="default" period="one-time" />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Bottom action row — all 3 send-shaped buttons save the quote first
          (status='sent') and then signal the detail page to open the right
          dialog via a ?send= query param. "Duplicate" stays placeholder
          until we wire a real duplicate flow. */}
      {lineItems.length > 0 && (
        <div className="flex justify-end gap-2 flex-wrap">
          <Button
            variant="ghost"
            icon="copy"
            onClick={() => toast.info("Duplicate is coming soon — for now use Quotes → New")}
          >
            Duplicate
          </Button>
          <Button
            icon="mail"
            onClick={() => handleSubmit("sent", "email")}
            loading={createQuote.isPending}
            disabled={!isLeadMode && !customerId && !prospectName.trim()}
          >
            Send via email
          </Button>
          <Button
            icon="whatsapp"
            className="!text-[#25D366] !border-[#25D366] hover:!bg-[#25D366]/5"
            onClick={() => handleSubmit("sent", "whatsapp")}
            loading={createQuote.isPending}
            disabled={!isLeadMode && !customerId && !prospectName.trim()}
          >
            Send via WhatsApp
          </Button>
          <Button
            variant="primary"
            icon="check_circle"
            onClick={() => handleSubmit("sent")}
            loading={createQuote.isPending}
            disabled={!isLeadMode && !customerId && !prospectName.trim()}
          >
            Finalize quote
          </Button>
        </div>
      )}

      {/* Add item modal */}
      <AddLineItemDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addLine} />

      {/* Customer-facing quote preview — shows placeholder ID before save */}
      <QuotePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        tenantName={currentUser?.tenantName    ?? "Workspace"}
        tenantGstin={currentUser?.tenantGstin}
        tenantEmail={currentUser?.tenantEmail}
        tenantPhone={currentUser?.tenantPhone}
        tenantAddress={currentUser?.tenantAddress}
        quoteId={quoteId ?? "(pending)"}
        customerName={isLeadMode ? (leadCompany ?? "Prospect") : (customer?.name ?? prospectName.trim() ?? "—")}
        contactName={isLeadMode ? leadContact : null}
        contactEmail={isLeadMode ? leadEmail : null}
        contactPhone={isLeadMode ? leadPhone : null}
        lineItems={lineItems}
        subtotal={subtotal}
        discountPct={discountPct}
        discount={discount}
        taxable={taxable}
        taxRate={taxRate}
        tax={tax}
        total={total}
        interState={interState}
        validityDays={validityDays}
        notes={notes}
        isProspect={isLeadMode}
      />
    </div>
  );
}

// ============================================================
// TotalRow helper
// ============================================================
function TotalRow({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  return (
    <div className="flex justify-between items-baseline text-sm">
      <span className="text-ink-3">{label}</span>
      <span className={cn(
        "tabular-nums",
        tone === "emerald" && "text-emerald",
        tone === "rose" && "text-rose"
      )}>{value}</span>
    </div>
  );
}
