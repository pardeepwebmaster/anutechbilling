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
import { toast } from "sonner";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

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

function CompanyTab() {
  const { data: me } = useCurrentUser();
  // Values reflect the actual tenant — form is read-only preview for now.
  // Persisting edits is a separate work item (needs UPDATE on tenants table
  // gated by owner role + RHF submit handler).
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Company information */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Company information</p>
          <Badge kind="muted">Read-only preview</Badge>
        </div>
        <div className="space-y-3">
          <Field label="Legal name">
            <Input key={me?.tenantName} defaultValue={me?.tenantName ?? ""} readOnly />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GSTIN">
              <Input key={me?.tenantGstin} className="font-mono" defaultValue={me?.tenantGstin ?? ""} placeholder="Not set" readOnly />
            </Field>
            <Field label="State code">
              <Input key={me?.tenantStateCode} className="font-mono" defaultValue={me?.tenantStateCode ?? ""} placeholder="—" readOnly />
            </Field>
          </div>
          <Field label="Registered state">
            <Input key={me?.tenantState} defaultValue={me?.tenantState ?? ""} placeholder="Not set" readOnly />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing email">
              <Input key={me?.tenantEmail} className="font-mono" defaultValue={me?.tenantEmail ?? ""} placeholder="—" readOnly />
            </Field>
            <Field label="Phone">
              <Input key={me?.tenantPhone} className="font-mono" defaultValue={me?.tenantPhone ?? ""} placeholder="—" readOnly />
            </Field>
          </div>
          <Field label="Currency">
            <Input defaultValue="INR (₹)" readOnly />
          </Field>
          <Field label="Address">
            <textarea
              key={me?.tenantAddress}
              defaultValue={me?.tenantAddress ?? ""}
              placeholder="Not set"
              rows={3}
              readOnly
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber resize-none"
            />
          </Field>
        </div>
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
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success("Settings saved");
  }

  return (
    <div className="mx-auto max-w-screen-xl px-8 pb-20 pt-7">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-ink-3">
            System
          </p>
          <h1 className="font-serif text-3xl text-ink">Settings & Team</h1>
          <p className="mt-1 text-sm text-ink-3">
            Configure your reseller business
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
        >
          <Icon name="check" size={14} />
          Save changes
        </Button>
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
