/**
 * Settings — reseller business configuration.
 *
 * Team management lives on its own page at /team now. This page is
 * just configuration: company identity, integrations, branding,
 * notifications, security.
 *
 * Layout:
 *   - Page header (System · Settings)
 *   - 5 tabs: Company / Integrations / Branding / Notifications / Security
 *   - Company tab: Company information form (full-width — no Team panel)
 *   - Integrations tab: 6 integration cards
 *   - Other tabs: "Coming soon" placeholder
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useUpdateTenant } from "@/lib/queries/tenant";
import { isValidGstin, gstStateFromGstin, validateGstin } from "@/lib/utils";
import GstinVerifyCard from "@/components/features/gstin/gstin-verify-card";
import SandboxConfigureDialog  from "@/components/features/integrations/sandbox-configure-dialog";
import WhatsAppConfigureDialog from "@/components/features/integrations/whatsapp-configure-dialog";
import RazorpayConfigureDialog from "@/components/features/integrations/razorpay-configure-dialog";
import GeminiConfigureDialog from "@/components/features/integrations/gemini-configure-dialog";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TenantWithParent } from "@/lib/supabase/database.types";

// ─── Demo data ────────────────────────────────────────────────────────────────
// Team roster moved to its own /team page. Settings only owns the
// non-people configuration surfaces (company identity, integrations,
// branding, notifications, security).

// Placeholder integrations — these aren't wired yet, but show the
// roadmap to Pardeep. Functional cards (Sandbox, WhatsApp) live as
// their own components above the placeholder list.
const INTEGRATIONS = [
  { name: "Gmail API",           sub: "Last synced 5 min ago",  status: "ok",   icon: "mail"     },
  { name: "Zoho Books",          sub: "Auto-sync ON",            status: "ok",   icon: "receipt"  },
  { name: "Google Reseller API", sub: "Auth valid",              status: "ok",   icon: "package"  },
  { name: "Microsoft Partner",   sub: "Not configured",          status: "warn", icon: "shield"   },
] as const;

const TABS: TabBarItem[] = [
  { id: "company",       label: "Company"       },
  { id: "integrations",  label: "Integrations"  },
  { id: "branding",      label: "Branding"      },
  { id: "notifications", label: "Notifications" },
  { id: "security",      label: "Security"      },
];

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-ink-3">{label}</label>
      {children}
    </div>
  );
}

// ─── Company tab ──────────────────────────────────────────────────────────────

const companySchema = z.object({
  name:         z.string().min(1, "Required").max(120),
  contact_name: z.string().trim().max(120).optional(),
  gstin:        z.string().trim().optional().superRefine((v, ctx) => {
    if (!v) return;
    const r = validateGstin(v);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.message });
  }),
  state:      z.string().trim().max(40).optional(),
  state_code: z.string().trim().regex(/^\d{0,2}$/, "1–2 digit code (e.g. 27)").optional(),
  email:      z.string().email("Invalid email").or(z.literal("")).optional(),
  phone:      z.string().trim().max(20).optional(),
  address:    z.string().trim().max(300).optional(),
  pin_code:   z.string().trim().regex(/^\d{0,6}$/, "6-digit PIN (or blank)").optional(),
  grace_period_days: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .int("Whole days only")
    .min(0, "Cannot be negative")
    .max(30, "Max 30 days"),
});
type CompanyForm = z.infer<typeof companySchema>;

function CompanyTab() {
  const { data: me, isLoading } = useCurrentUser();
  const updateTenant = useUpdateTenant();
  const isOwner = me?.role === "owner";

  const defaults: CompanyForm = React.useMemo(
    () => ({
      name:         me?.tenantName        ?? "",
      contact_name: me?.tenantContactName ?? "",
      gstin:        me?.tenantGstin       ?? "",
      state:        me?.tenantState       ?? "",
      state_code:   me?.tenantStateCode   ?? "",
      email:        me?.tenantEmail       ?? "",
      phone:        me?.tenantPhone       ?? "",
      address:      me?.tenantAddress     ?? "",
      pin_code:     me?.tenantPinCode     ?? "",
      grace_period_days: me?.tenantGracePeriodDays ?? 0,
    }),
    [me],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: defaults,
  });

  // Refresh defaults once useCurrentUser settles
  React.useEffect(() => { reset(defaults); }, [defaults, reset]);

  // Auto-derive state + state_code from GSTIN.
  // First 2 digits of a GSTIN encode the state per GSTN master list.
  // Mark fields dirty so the form's "Save changes" button activates.
  const watchedGstin = watch("gstin");
  React.useEffect(() => {
    const { code, name } = gstStateFromGstin(watchedGstin ?? "");
    if (code) setValue("state_code", code, { shouldDirty: true, shouldValidate: true });
    if (name) setValue("state",      name, { shouldDirty: true, shouldValidate: true });
  }, [watchedGstin, setValue]);

  const onSubmit = (values: CompanyForm) => {
    // Normalize empty strings to null so DB nulls stay null and constraints are honored
    const patch = {
      name:         values.name.trim(),
      contact_name: values.contact_name?.trim() || null,
      gstin:        values.gstin?.trim()        || null,
      state:        values.state?.trim()        || null,
      state_code:   values.state_code?.trim()   || null,
      email:        values.email?.trim()        || me?.tenantEmail || "",  // keep existing if blanked — email is NOT NULL on tenants
      phone:        values.phone?.trim()        || null,
      address:      values.address?.trim()      || null,
      pin_code:     values.pin_code?.trim()     || null,
      grace_period_days: values.grace_period_days,
    };
    updateTenant.mutate(patch, { onSuccess: () => reset(values) });
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Reseller hierarchy (migration 0040). Read-only display for now —
          link/unlink controls land in a later slice. */}
      <ResellerTierCard />

      {/* Company information — full-width now that Team is its own page */}
      <Card className="p-5 max-w-3xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Company information</p>
            {!isOwner && <Badge kind="muted">Owner-only · view</Badge>}
            {isOwner && isDirty && <Badge kind="warning" dot>Unsaved changes</Badge>}
          </div>

          {isLoading ? (
            <p className="text-xs text-ink-3">Loading…</p>
          ) : (
            <fieldset disabled={!isOwner || isSubmitting} className="space-y-3 disabled:opacity-60">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Legal name *">
                  <Input
                    placeholder="E.g., Excel Technologies Pvt Ltd"
                    error={errors.name?.message}
                    {...register("name")}
                  />
                </Field>
                <Field label="Owner / contact name">
                  <Input
                    placeholder="E.g., Pardeep A"
                    error={errors.contact_name?.message}
                    {...register("contact_name")}
                  />
                </Field>
              </div>
              {/* GSTIN — full row. The "state code" is the first 2 digits
                  of this field, so we don't show a separate input for it;
                  RHF still tracks it via a hidden register (set by the
                  auto-fill useEffect higher up). */}
              <Field label="GSTIN">
                <Input
                  className="font-mono uppercase"
                  placeholder="27AABCE1234D1Z9"
                  error={errors.gstin?.message}
                  {...register("gstin")}
                />
                {(() => {
                  const v = (watchedGstin ?? "").trim();
                  if (v.length < 15)        return (
                    <p className="mt-1 text-[10px] text-ink-3">
                      State + state code auto-fill from the first 2 digits.
                    </p>
                  );
                  if (isValidGstin(v))      return (
                    <p className="mt-1 text-[10px] text-emerald inline-flex items-center gap-1">
                      <Icon name="check_circle" size={11} /> Format + checksum match. Click Verify to confirm with GSTN.
                    </p>
                  );
                  return (
                    <p className="mt-1 text-[10px] text-rose inline-flex items-center gap-1">
                      <Icon name="alert" size={11} /> {validateGstin(v).ok ? "" : (validateGstin(v) as { message: string }).message}
                    </p>
                  );
                })()}
                <GstinVerifyCard
                  gstin={watchedGstin ?? ""}
                  cached={me?.tenantGstinVerification ?? null}
                  cachedAt={me?.tenantGstinVerifiedAt}
                  onFillForm={(v) => {
                    if (v.legal_name)                  setValue("name",       v.legal_name,                  { shouldDirty: true, shouldValidate: true });
                    if (v.address)                     setValue("address",    v.address,                     { shouldDirty: true, shouldValidate: true });
                    if (v.principal_address?.pin_code) setValue("pin_code",   v.principal_address.pin_code,  { shouldDirty: true, shouldValidate: true });
                    if (v.state_code)                  setValue("state_code", v.state_code,                  { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </Field>

              {/* Hidden state_code — derived from GSTIN, but RHF still
                  manages it so the form submission carries the value. */}
              <input type="hidden" {...register("state_code")} />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Registered state">
                  <Input
                    placeholder="Auto-filled from GSTIN — usually no need to edit"
                    error={errors.state?.message}
                    {...register("state")}
                  />
                </Field>
                <Field label="PIN code">
                  <Input
                    className="font-mono"
                    placeholder="400051"
                    maxLength={6}
                    error={errors.pin_code?.message}
                    {...register("pin_code")}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Billing email">
                  <Input
                    type="email"
                    className="font-mono"
                    placeholder="billing@example.in"
                    error={errors.email?.message}
                    {...register("email")}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    className="font-mono"
                    placeholder="+91 98765 43210"
                    error={errors.phone?.message}
                    {...register("phone")}
                  />
                </Field>
              </div>
              <Field label="Currency">
                <Input defaultValue="INR (₹)" readOnly title="Multi-currency support coming later" />
              </Field>
              <Field label="Renewal grace period (days)">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  className="font-mono"
                  placeholder="0"
                  error={errors.grace_period_days?.message}
                  {...register("grace_period_days", { valueAsNumber: true })}
                />
                <p className="mt-1 text-xs text-ink-3">
                  Buffer between renewal date and auto-suspend. 0 means service suspends the day after renewal if unpaid; up to 30 days extra.
                </p>
              </Field>
              <Field label="Address">
                <textarea
                  placeholder="Building, street, city, state, PIN"
                  rows={3}
                  className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber resize-none"
                  {...register("address")}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-rose">{errors.address.message}</p>
                )}
              </Field>

              <div className="flex items-center justify-end gap-2 pt-2">
                {isDirty && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => reset(defaults)}>
                    Discard
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  icon="check"
                  loading={updateTenant.isPending}
                  disabled={!isDirty || !isOwner}
                >
                  Save changes
                </Button>
              </div>
            </fieldset>
          )}
        </form>
      </Card>
    </div>
  );
}

// ─── Reseller hierarchy card (migration 0040) ────────────────────────────────

/**
 * ResellerTierCard — surfaces this tenant's place in the parent-child
 * distributor / reseller hierarchy.
 *
 * Reads from the `v_tenant_with_parent` view (added in 0040_reseller_hierarchy).
 * The view's RLS is layered: the tenant always sees its own row, and if its
 * `parent_tenant_id` is set the additive policy lets it read the parent's
 * display fields (name / tier / gstin) — nothing else.
 *
 * Slice 0: read-only. Settings to declare-self-distributor or pick a parent
 * land in Slice 1 (Partner Catalog) when there's a concrete reason to wire
 * the link from the UI.
 */
function ResellerTierCard() {
  const { data: me } = useCurrentUser();
  const isOwner = me?.role === "owner";

  // The view's LEFT JOIN gets blocked by RLS for the parent's row, so we go
  // through a SECURITY DEFINER RPC that returns only the calling user's own
  // tenant + its parent's display fields. See migration 0040.
  const { data, isLoading } = useQuery({
    enabled: Boolean(me?.tenantId),
    queryKey: ["tenant", "hierarchy", me?.tenantId],
    queryFn: async (): Promise<TenantWithParent | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_tenant_with_parent");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as TenantWithParent | undefined) ?? null;
    },
  });

  if (!isOwner) return null;  // hide entirely for non-owners — admin-only surface
  if (isLoading) return null; // soft-fail: no shimmer needed for a 1-row read

  const tier         = data?.tier ?? "reseller";
  const isDistributor = tier === "distributor";
  const parentName   = data?.parent_name;

  return (
    <Card className="p-5 max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink inline-flex items-center gap-2">
          <Icon name="layout" size={14} className="text-ink-3" />
          Reseller tier
        </p>
        <Badge kind={isDistributor ? "success" : "muted"} dot>
          {isDistributor ? "Distributor" : "Reseller"}
        </Badge>
      </div>

      {/* Three cases:
          1. Distributor (has or will have children) — Excel Tech
          2. Reseller with parent — Anutech Digital
          3. Reseller without parent — independent peer tenant (most signups) */}
      {isDistributor ? (
        <div className="space-y-2 text-xs text-ink-3 leading-relaxed">
          <p>
            <span className="text-ink-2 font-medium">{data?.name}</span> ka role: <b>Master reseller / Distributor</b>.
            Sub-resellers (children) is tenant ke catalog par wholesale rates par chal sakte hain.
          </p>
          <p className="text-[11px] text-ink-3">
            Children manage karna · Partner Catalog publish karna · cross-tenant invoice mirroring — ye sab Slice 1+ me unlock honge.
          </p>
        </div>
      ) : parentName ? (
        <div className="space-y-2 text-xs text-ink-3 leading-relaxed">
          <p>
            Wholesale supplier: <span className="text-ink-2 font-medium">{parentName}</span>
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-ink-3 font-mono">
              <Icon name="link" size={10} /> hierarchy linked
            </span>
          </p>
          <p className="text-[11px] text-ink-3">
            Distributor ke catalog se SKUs sync karna · auto vendor-bill on parent invoices · renewal sync — Slice 1+ me unlock honge.
          </p>
        </div>
      ) : (
        <div className="space-y-2 text-xs text-ink-3 leading-relaxed">
          <p>
            Independent reseller — kisi distributor se attached nahi. Apne customers ko direct serve karte ho, apna catalog manage karte ho.
          </p>
          <p className="text-[11px] text-ink-3">
            Agar tum kisi master reseller (distributor) se wholesale leke aage bechte ho — Slice 1+ me link karne ka option milega.
          </p>
        </div>
      )}
    </Card>
  );
}

// ─── Integrations tab ────────────────────────────────────────────────────────

/** Functional integration card — has its own Configure dialog. */
function SandboxIntegrationCard() {
  const [open, setOpen] = React.useState(false);
  const { data: status } = useQuery({
    queryKey: ["integrations", "sandbox"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/sandbox");
      return res.ok ? res.json() : null;
    },
  });
  const configured = Boolean(status?.configured);
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-2 text-ink-3">
            <Icon name="check_circle" size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Sandbox.co.in</p>
            <p className="text-xs text-ink-3 truncate">
              GSTIN verification · {configured ? "Live mode" : "Mock fallback"}
            </p>
          </div>
        </div>
        <Button variant={configured ? "ghost" : "primary"} size="sm" onClick={() => setOpen(true)}>
          {configured ? "Manage" : "Setup"}
        </Button>
      </div>
      {open && <SandboxConfigureDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

/** WhatsApp Business (Meta Cloud API) — functional integration card. */
function WhatsAppIntegrationCard() {
  const [open, setOpen] = React.useState(false);
  const { data: status } = useQuery({
    queryKey: ["integrations", "whatsapp"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/whatsapp");
      return res.ok ? res.json() : null;
    },
  });
  const configured = Boolean(status?.configured);
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-2 text-ink-3">
            <Icon name="whatsapp" size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">WhatsApp Business</p>
            <p className="text-xs text-ink-3 truncate">
              Meta Cloud API · {configured ? "Connected" : "Not configured"}
            </p>
          </div>
        </div>
        <Button variant={configured ? "ghost" : "primary"} size="sm" onClick={() => setOpen(true)}>
          {configured ? "Manage" : "Setup"}
        </Button>
      </div>
      {open && <WhatsAppConfigureDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

/** Razorpay payments — functional integration card. Mode is inferred
 *  from saved key_id prefix (rzp_test_* / rzp_live_*). */
function RazorpayIntegrationCard() {
  const [open, setOpen] = React.useState(false);
  const { data: status } = useQuery({
    queryKey: ["integrations", "razorpay"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/razorpay");
      return res.ok ? res.json() : null;
    },
  });
  const configured = Boolean(status?.configured);
  const mode       = (status?.mode as "test" | "live" | undefined) ?? "test";
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-2 text-ink-3">
            <Icon name="rupee" size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink inline-flex items-center gap-1.5">
              Razorpay
              {configured && (
                <Badge size="sm" kind={mode === "live" ? "success" : "warning"}>
                  {mode === "live" ? "LIVE" : "TEST"}
                </Badge>
              )}
            </p>
            <p className="text-xs text-ink-3 truncate">
              {configured ? "Accepting payments" : "Buy page in simulation mode"}
            </p>
          </div>
        </div>
        <Button variant={configured ? "ghost" : "primary"} size="sm" onClick={() => setOpen(true)}>
          {configured ? "Manage" : "Setup"}
        </Button>
      </div>
      {open && <RazorpayConfigureDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

function GeminiIntegrationCard() {
  const [open, setOpen] = React.useState(false);
  const { data: status } = useQuery({
    queryKey: ["integrations", "gemini"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/gemini");
      return res.ok ? res.json() : null;
    },
  });
  const configured = Boolean(status?.configured);
  const envFallback = Boolean(status?.env_fallback);
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-2 text-amber">
            <Icon name="sparkles" size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink inline-flex items-center gap-1.5">
              AI assistant
              {configured
                ? <Badge size="sm" kind="success">Live</Badge>
                : envFallback
                  ? <Badge size="sm" kind="info">Shared</Badge>
                  : <Badge size="sm" kind="muted">Stub</Badge>}
            </p>
            <p className="text-xs text-ink-3 truncate">
              {configured ? "Real AI drafts + extraction" : envFallback ? "Using shared server key" : "Templates only — add a Gemini key"}
            </p>
          </div>
        </div>
        <Button variant={configured ? "ghost" : "primary"} size="sm" onClick={() => setOpen(true)}>
          {configured ? "Manage" : "Setup"}
        </Button>
      </div>
      {open && <GeminiConfigureDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

function IntegrationsTab() {
  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-ink">Connected services</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <GeminiIntegrationCard />
        <RazorpayIntegrationCard />
        <SandboxIntegrationCard />
        <WhatsAppIntegrationCard />
        {INTEGRATIONS.map((it) => (
          <div
            key={it.name}
            className="flex items-center justify-between rounded-lg border border-hairline p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-2 text-ink-3">
                <Icon name={it.icon} size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{it.name}</p>
                <p className="text-xs text-ink-3">{it.sub}</p>
              </div>
            </div>
            {it.status === "ok" ? (
              <Badge kind="success" dot>Connected</Badge>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => toast.info(`Setting up ${it.name}`)}
              >
                Setup
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Placeholder tab ─────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-paper-2 text-ink-3">
        <Icon name="settings" size={28} />
      </div>
      <p className="font-serif text-xl text-ink">{label}</p>
      <p className="mt-2 text-sm text-ink-3">Coming in the next release</p>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = React.useState("company");

  return (
    <div className="mx-auto max-w-[1800px] px-8 pb-20 pt-7">
      {/* ── Page header ── */}
      <div className="mb-6">
        <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-ink-3">
          System
        </p>
        <h1 className="font-serif text-3xl text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-3">
          Configure your reseller business · Team management lives at <span className="font-medium text-ink-2">/team</span>
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6">
        <TabBar items={TABS} value={tab} onChange={setTab} />
      </div>

      {/* ── Tab content ── */}
      {tab === "company"       && <CompanyTab />}
      {tab === "integrations"  && <IntegrationsTab />}
      {tab === "branding"      && <ComingSoon label="Branding" />}
      {tab === "notifications" && <ComingSoon label="Notifications" />}
      {tab === "security"      && <ComingSoon label="Security" />}
    </div>
  );
}
