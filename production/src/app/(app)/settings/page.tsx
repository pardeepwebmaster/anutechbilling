/**
 * Settings & Team — matches prototype screen D4.
 *
 * Layout:
 *   - Page header (System · Settings & Team + Save changes)
 *   - 6 tabs: Company / Team / Integrations / Branding / Notifications / Security
 *   - Company tab: Company information form + Team members table
 *   - Integrations tab: 6 integration cards
 *   - Other tabs: "Coming soon" placeholder
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useUpdateTenant } from "@/lib/queries/tenant";
import { isValidGstin } from "@/lib/utils";

// ─── Demo data ────────────────────────────────────────────────────────────────

const TEAM_MEMBERS = [
  { name: "Pardeep A",  initials: "PA", color: "amber"   as const, role: "Owner",      email: "pardeep@exceltechnologies.in" },
  { name: "Rahul B",    initials: "RB", color: "indigo"  as const, role: "Sales",       email: "rahul@exceltechnologies.in" },
  { name: "Priya R",    initials: "PR", color: "slate"   as const, role: "Sales",       email: "priya@exceltechnologies.in" },
  { name: "Amit M",     initials: "AM", color: "emerald" as const, role: "Accountant",  email: "amit@exceltechnologies.in" },
  { name: "Anjali R",   initials: "AR", color: "rose"    as const, role: "Support",     email: "anjali@exceltechnologies.in" },
];

const INTEGRATIONS = [
  { name: "Gmail API",           sub: "Last synced 5 min ago",  status: "ok",   icon: "mail"     },
  { name: "Razorpay",            sub: "Live mode",               status: "ok",   icon: "rupee"    },
  { name: "Zoho Books",          sub: "Auto-sync ON",            status: "ok",   icon: "receipt"  },
  { name: "Google Reseller API", sub: "Auth valid",              status: "ok",   icon: "package"  },
  { name: "Microsoft Partner",   sub: "Not configured",          status: "warn", icon: "shield"   },
  { name: "WhatsApp Business",   sub: "Verified",                status: "ok",   icon: "whatsapp" },
] as const;

const TABS: TabBarItem[] = [
  { id: "company",       label: "Company"       },
  { id: "team",          label: "Team"          },
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
  name:       z.string().min(1, "Required").max(120),
  gstin:      z.string().trim().optional().refine(
    (v) => !v || isValidGstin(v),
    "Must be a valid 15-char GSTIN (e.g. 27AABCE1234D1Z9)",
  ),
  state:      z.string().trim().max(40).optional(),
  state_code: z.string().trim().regex(/^\d{0,2}$/, "1–2 digit code (e.g. 27)").optional(),
  email:      z.string().email("Invalid email").or(z.literal("")).optional(),
  phone:      z.string().trim().max(20).optional(),
  address:    z.string().trim().max(300).optional(),
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
      name:       me?.tenantName       ?? "",
      gstin:      me?.tenantGstin      ?? "",
      state:      me?.tenantState      ?? "",
      state_code: me?.tenantStateCode  ?? "",
      email:      me?.tenantEmail      ?? "",
      phone:      me?.tenantPhone      ?? "",
      address:    me?.tenantAddress    ?? "",
      grace_period_days: me?.tenantGracePeriodDays ?? 0,
    }),
    [me],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: defaults,
  });

  // Refresh defaults once useCurrentUser settles
  React.useEffect(() => { reset(defaults); }, [defaults, reset]);

  const onSubmit = (values: CompanyForm) => {
    // Normalize empty strings to null so DB nulls stay null and constraints are honored
    const patch = {
      name:       values.name.trim(),
      gstin:      values.gstin?.trim()      || null,
      state:      values.state?.trim()      || null,
      state_code: values.state_code?.trim() || null,
      email:      values.email?.trim()      || me?.tenantEmail || "",  // keep existing if blanked — email is NOT NULL on tenants
      phone:      values.phone?.trim()      || null,
      address:    values.address?.trim()    || null,
      grace_period_days: values.grace_period_days,
    };
    updateTenant.mutate(patch, { onSuccess: () => reset(values) });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Company information */}
      <Card className="p-5">
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
              <Field label="Legal name *">
                <Input
                  placeholder="E.g., Excel Technologies Pvt Ltd"
                  error={errors.name?.message}
                  {...register("name")}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="GSTIN">
                  <Input
                    className="font-mono uppercase"
                    placeholder="27AABCE1234D1Z9"
                    error={errors.gstin?.message}
                    {...register("gstin")}
                  />
                </Field>
                <Field label="State code">
                  <Input
                    className="font-mono"
                    placeholder="27"
                    maxLength={2}
                    error={errors.state_code?.message}
                    {...register("state_code")}
                  />
                </Field>
              </div>
              <Field label="Registered state">
                <Input
                  placeholder="E.g., Maharashtra"
                  error={errors.state?.message}
                  {...register("state")}
                />
              </Field>
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

      {/* Team members */}
      <TeamTab compact />
    </div>
  );
}

// ─── Team tab ─────────────────────────────────────────────────────────────────

function TeamTab({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Team members</p>
          <p className="text-xs text-ink-3">
            {TEAM_MEMBERS.length} active · 3 seats remaining
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => toast.info("Invite coming soon")}
        >
          <Icon name="plus" size={13} />
          Invite member
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline">
            {["Name", "Role", "Status", ""].map((h) => (
              <th
                key={h}
                className="pb-2 text-left text-xs font-medium text-ink-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TEAM_MEMBERS.map((m) => (
            <tr key={m.name} className="border-b border-hairline last:border-0">
              <td className="py-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={m.initials} color={m.color} size="sm" />
                  <div>
                    <p className="font-medium text-ink">{m.name}</p>
                    {!compact && (
                      <p className="text-xs text-ink-3 font-mono">{m.email}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-2.5">
                <Badge kind={m.role === "Owner" ? "info" : "muted"}>
                  {m.role}
                </Badge>
              </td>
              <td className="py-2.5">
                <Badge kind="success" dot>Online</Badge>
              </td>
              <td className="py-2.5 text-right">
                <IconButton
                  icon="more_h"
                  variant="ghost"
                  size="sm"
                  aria-label="Team member options"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Integrations tab ────────────────────────────────────────────────────────

function IntegrationsTab() {
  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-ink">Connected services</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <h1 className="font-serif text-3xl text-ink">Settings & Team</h1>
        <p className="mt-1 text-sm text-ink-3">
          Configure your reseller business
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6">
        <TabBar items={TABS} value={tab} onChange={setTab} />
      </div>

      {/* ── Tab content ── */}
      {tab === "company"       && <CompanyTab />}
      {tab === "team"          && <TeamTab />}
      {tab === "integrations"  && <IntegrationsTab />}
      {tab === "branding"      && <ComingSoon label="Branding" />}
      {tab === "notifications" && <ComingSoon label="Notifications" />}
      {tab === "security"      && <ComingSoon label="Security" />}
    </div>
  );
}
