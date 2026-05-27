/**
 * Team — dedicated page for managing team members.
 *
 * Was previously a tab under Settings & Team. Split out into its own
 * sidebar entry so day-to-day operations (inviting a salesperson,
 * checking who's online) don't get buried inside Settings.
 *
 * Data shape: TEAM_MEMBERS is still mock-only — when we wire real
 * Supabase Auth invites this is where the migration lands.
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { KPI } from "@/components/shared/kpi";

const TEAM_MEMBERS = [
  { name: "Pardeep A",  initials: "PA", color: "amber"   as const, role: "Owner",      email: "pardeep@exceltechnologies.in", status: "online"  },
  { name: "Rahul B",    initials: "RB", color: "indigo"  as const, role: "Sales",      email: "rahul@exceltechnologies.in",   status: "online"  },
  { name: "Priya R",    initials: "PR", color: "slate"   as const, role: "Sales",      email: "priya@exceltechnologies.in",   status: "online"  },
  { name: "Amit M",     initials: "AM", color: "emerald" as const, role: "Accountant", email: "amit@exceltechnologies.in",    status: "online"  },
  { name: "Anjali R",   initials: "AR", color: "rose"    as const, role: "Support",    email: "anjali@exceltechnologies.in",  status: "online"  },
];

const ROLE_TONE: Record<string, "success" | "info" | "muted" | "warning"> = {
  Owner:      "info",
  Sales:      "success",
  Accountant: "warning",
  Support:    "muted",
};

export default function TeamPage() {
  const total      = TEAM_MEMBERS.length;
  const seatsLeft  = 3;
  const onlineNow  = TEAM_MEMBERS.filter((m) => m.status === "online").length;
  const owners     = TEAM_MEMBERS.filter((m) => m.role === "Owner").length;

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-20 pt-6 md:px-6 md:pt-7 lg:px-8">
      {/* ── Header ── */}
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-ink-3">
            System
          </p>
          <h1 className="font-serif text-3xl text-ink md:text-4xl">Team</h1>
          <p className="mt-1 text-sm text-ink-3">
            Invite teammates, assign roles, manage access
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => toast.info("Invite flow coming soon")}>
          Invite member
        </Button>
      </div>

      {/* ── KPIs ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Total members" value={total} icon="users" />
        <KPI label="Online right now" value={onlineNow} icon="check_circle" />
        <KPI label="Seats remaining" value={seatsLeft} icon="user" />
        <KPI label="Owners" value={owners} icon="award" />
      </div>

      {/* ── Members table ── */}
      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Member</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Email</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Role</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Status</th>
                <th className="p-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_MEMBERS.map((m) => (
                <tr key={m.email} className="border-b border-hairline last:border-0 hover:bg-paper-2/40">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={m.initials} color={m.color} size="sm" />
                      <p className="font-medium text-ink">{m.name}</p>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-ink-2">{m.email}</td>
                  <td className="p-3">
                    <Badge kind={ROLE_TONE[m.role] ?? "muted"}>{m.role}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge kind="success" dot>Online</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <IconButton
                      icon="more_h"
                      variant="ghost"
                      size="sm"
                      aria-label="Member actions"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
        <Icon name="info" size={11} />
        Real Supabase Auth invites are wired in the next release. For now this is the seed roster.
      </p>
    </div>
  );
}
