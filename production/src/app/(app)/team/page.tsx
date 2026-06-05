/**
 * Team — real teammate management (migration 0073).
 *
 * An owner invites a teammate by email + role. The invite pre-authorizes that
 * email: when they first sign in with Google, the OAuth callback finds the
 * invite and adds them to THIS tenant (instead of creating a new empty one).
 *
 * This is also how a second Google account (e.g. the Google reseller-admin
 * info@…) joins the tenant so it can run the live "Sync from Google".
 *
 * Security: team_invites is owner-only via RLS; the unique index on lower(email)
 * means an email can belong to at most one tenant's invite (no ambiguity).
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { KPI } from "@/components/shared/kpi";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

type Role = "owner" | "sales" | "accountant" | "support";
const ROLES: Role[] = ["owner", "sales", "accountant", "support"];
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", sales: "Sales", accountant: "Accountant", support: "Support" };
const ROLE_TONE: Record<Role, "success" | "info" | "muted" | "warning"> = {
  owner: "info", sales: "success", accountant: "warning", support: "muted",
};

interface Member { id: string; full_name: string | null; email: string | null; role: Role; initials: string | null; color: string | null; is_active: boolean | null; }
interface Invite { id: string; email: string; role: Role; created_at: string; }

export default function TeamPage() {
  const { data: me } = useCurrentUser();
  const isOwner = me?.role === "owner";
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["team", "members"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, initials, color, is_active")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["team", "invites"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team_invites")
        .select("id, email, role, created_at")
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
    enabled: isOwner,
  });

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("team_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team", "invites"] }); toast.success("Invite removed"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove invite"),
  });

  const owners = members.filter((m) => m.role === "owner").length;

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-20 pt-6 md:px-6 md:pt-7 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-ink-3">System</p>
          <h1 className="font-serif text-3xl text-ink md:text-4xl">Team</h1>
          <p className="mt-1 text-sm text-ink-3">Invite teammates, assign roles, manage access</p>
        </div>
        {isOwner && (
          <Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>Invite member</Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Members" value={members.length} icon="users" />
        <KPI label="Pending invites" value={invites.length} icon="mail" />
        <KPI label="Owners" value={owners} icon="award" />
        <KPI label="Active" value={members.filter((m) => m.is_active !== false).length} icon="check_circle" />
      </div>

      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Member</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Email</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Role</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-hairline last:border-0 hover:bg-paper-2/40">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={m.initials ?? "?"} color={(m.color as never) ?? "slate"} size="sm" />
                      <p className="font-medium text-ink">{m.full_name ?? "—"}{m.id === me?.userId && <span className="text-ink-3 font-normal"> (you)</span>}</p>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-ink-2">{m.email}</td>
                  <td className="p-3"><Badge kind={ROLE_TONE[m.role] ?? "muted"}>{ROLE_LABEL[m.role] ?? m.role}</Badge></td>
                  <td className="p-3"><Badge kind={m.is_active === false ? "muted" : "success"} dot>{m.is_active === false ? "Inactive" : "Active"}</Badge></td>
                </tr>
              ))}

              {/* Pending invites (owner only) */}
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b border-hairline last:border-0 bg-amber-soft/20">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-2 text-ink-3"><Icon name="mail" size={13} /></div>
                      <p className="text-ink-2 italic">Invited</p>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-ink-2">{inv.email}</td>
                  <td className="p-3"><Badge kind={ROLE_TONE[inv.role] ?? "muted"}>{ROLE_LABEL[inv.role] ?? inv.role}</Badge></td>
                  <td className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge kind="warning" dot>Pending</Badge>
                      <IconButton icon="trash" variant="ghost" size="sm" aria-label="Remove invite"
                        onClick={() => removeInvite.mutate(inv.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
        <Icon name="info" size={11} />
        An invited email joins this workspace the first time they sign in with Google — no new tenant is created.
      </p>

      {isOwner && me && (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          tenantId={me.tenantId}
          invitedBy={me.userId}
          onInvited={() => qc.invalidateQueries({ queryKey: ["team", "invites"] })}
        />
      )}
    </div>
  );
}

function InviteDialog({ open, onOpenChange, tenantId, invitedBy, onInvited }: {
  open: boolean; onOpenChange: (v: boolean) => void; tenantId: string; invitedBy: string; onInvited: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("sales");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { if (!open) { setEmail(""); setRole("sales"); setSaving(false); } }, [open]);

  async function submit() {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@") || clean.length < 5) { toast.error("Enter a valid email."); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("team_invites").insert({ tenant_id: tenantId, email: clean, role, invited_by: invitedBy });
      if (error) {
        if (error.code === "23505") toast.error("That email is already invited (here or to another workspace).");
        else throw error;
        return;
      }
      toast.success(`Invited ${clean} — they join when they first sign in with Google.`);
      onInvited();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2"><Icon name="plus" size={18} className="text-amber" /> Invite a teammate</DialogTitle>
          <DialogDescription>
            They&apos;ll join this workspace the first time they sign in with Google using this email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="inv-email" className="block text-xs font-medium text-ink-2 mb-1">Email</label>
            <Input id="inv-email" type="email" placeholder="teammate@company.com" value={email}
              onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <label htmlFor="inv-role" className="block text-xs font-medium text-ink-2 mb-1">Role</label>
            <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-ink-3">For the Google reseller-admin account, pick <b>Owner</b> so it can run the sync + add subscriptions.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" variant="primary" loading={saving} onClick={submit}>Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
