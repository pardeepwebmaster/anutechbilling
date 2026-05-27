"use client";

/**
 * /portal/subscription — view + manage active subscription.
 *
 * Customer can:
 *   • See plan, seats, MRR, next renewal
 *   • Toggle auto-renewal on/off
 *   • Request a seat change (creates a support ticket of type 'plan_change')
 *
 * RLS scopes everything to their own customer_id.
 */
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { rupee, formatDate, daysBetween } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Sub {
  id:                 string;
  tenant_id:          string;
  customer_id:        string | null;
  customer_name:      string;
  plan:               string;
  vendor:             string;
  seats:              number;
  mrr:                number;
  start_date:         string | null;
  renewal_date:       string | null;
  status:             string;
  outstanding_amount: number;
  auto_renew:         boolean;
}

const changeSchema = z.object({
  newSeats:    z.coerce.number().int().min(1).max(10000),
  effectiveOn: z.string().min(1, "When?"),
  note:        z.string().optional(),
});
type ChangeData = z.infer<typeof changeSchema>;

function newTicketId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand  = Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `TKT-${stamp}-${rand}`;
}

export default function PortalSubscriptionPage() {
  const [subs, setSubs]               = React.useState<Sub[] | null>(null);
  const [changeOpen, setChangeOpen]   = React.useState(false);
  const [activeForChange, setActiveForChange] = React.useState<Sub | null>(null);
  const [toggling, setToggling]       = React.useState<string | null>(null);

  // Fetch on mount
  React.useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr, start_date, renewal_date, status, outstanding_amount, auto_renew")
        .order("renewal_date", { ascending: true });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSubs((data ?? []) as Sub[]);
    })();
  }, []);

  async function toggleAutoRenew(sub: Sub) {
    setToggling(sub.id);
    const newValue = !sub.auto_renew;
    const supabase = createClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({ auto_renew: newValue })
      .eq("id", sub.id);
    setToggling(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(newValue ? "Auto-renewal turned ON" : "Auto-renewal turned OFF");
    setSubs((prev) => prev?.map((s) => s.id === sub.id ? { ...s, auto_renew: newValue } : s) ?? null);
  }

  function openChange(sub: Sub) {
    setActiveForChange(sub);
    setChangeOpen(true);
  }

  if (!subs) {
    return (
      <div className="max-w-[1080px] mx-auto px-6 py-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const activeSubs = subs.filter((s) => s.status === "active");

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Your subscription</h1>
        <p className="text-sm text-ink-3 mt-1">
          Manage your plan, seats, and renewal settings.
        </p>
      </div>

      {activeSubs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-3">
          No active subscription on file. WhatsApp Pardeep on{" "}
          <b className="text-ink">+91 99999 30300</b> if you expect one to be here.
        </Card>
      ) : (
        <div className="space-y-4">
          {activeSubs.map((sub) => {
            const today = new Date().toISOString().slice(0, 10);
            const daysToRenewal = sub.renewal_date ? daysBetween(today, sub.renewal_date) : null;
            return (
              <Card key={sub.id} className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-1">
                      {sub.vendor === "google" ? "Google Workspace" :
                       sub.vendor === "microsoft" ? "Microsoft 365" :
                       sub.vendor === "zoho" ? "Zoho" : "Subscription"}
                    </div>
                    <h2 className="font-serif text-2xl text-ink leading-tight">{sub.plan}</h2>
                    <div className="text-xs text-ink-3 mt-1">
                      {sub.seats} {sub.seats === 1 ? "user" : "users"} ·{" "}
                      Started {sub.start_date ? formatDate(sub.start_date) : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-2xl text-ink leading-none">{rupee(sub.mrr)}</div>
                    <div className="text-[11px] text-ink-3 mt-1">/month equivalent</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-hairline text-sm mb-5">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-0.5">Next renewal</div>
                    <div className="font-medium text-ink">
                      {sub.renewal_date ? formatDate(sub.renewal_date) : "—"}
                    </div>
                    {daysToRenewal !== null && (
                      <div className={`text-[11px] mt-0.5 ${daysToRenewal <= 30 ? "text-amber-ink" : "text-ink-3"}`}>
                        {daysToRenewal <= 0
                          ? "Overdue"
                          : `In ${daysToRenewal} ${daysToRenewal === 1 ? "day" : "days"}`}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-0.5">Outstanding</div>
                    <div className={`font-medium ${sub.outstanding_amount > 0 ? "text-rose" : "text-emerald"}`}>
                      {sub.outstanding_amount > 0 ? rupee(sub.outstanding_amount) : "Nil"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-0.5">Auto-renewal</div>
                    <button
                      type="button"
                      disabled={toggling === sub.id}
                      onClick={() => toggleAutoRenew(sub)}
                      className={`inline-flex items-center gap-2 text-sm font-medium ${sub.auto_renew ? "text-emerald" : "text-ink-3"}`}
                    >
                      <span
                        className={`inline-flex w-10 h-5 rounded-full transition-colors ${sub.auto_renew ? "bg-emerald" : "bg-paper-2 border border-hairline"} relative`}
                      >
                        <span
                          className={`absolute top-0.5 ${sub.auto_renew ? "left-5" : "left-0.5"} w-4 h-4 rounded-full bg-paper transition-all`}
                        />
                      </span>
                      {sub.auto_renew ? "On" : "Off"}
                    </button>
                    {!sub.auto_renew && (
                      <div className="text-[10px] text-amber-ink mt-1">Subscription will expire on renewal date</div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => openChange(sub)}>
                    <Icon name="users" size={14} className="mr-1.5" />
                    Request seat change
                  </Button>
                  <Button asChild variant="default">
                    <Link href="/portal/support/new">
                      <Icon name="ticket" size={14} className="mr-1.5" />
                      Other request
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Seat change form (renders inline as modal-ish card) */}
      {changeOpen && activeForChange && (
        <SeatChangeForm
          sub={activeForChange}
          onClose={() => { setChangeOpen(false); setActiveForChange(null); }}
        />
      )}

      <div className="mt-6 p-4 bg-paper-2/40 rounded-md text-xs text-ink-3 leading-relaxed">
        <Icon name="info" size={12} className="text-indigo inline mr-1 align-text-bottom" />
        <b className="text-ink">How requests work:</b> All seat / plan changes go through Pardeep
        as a ticket. He&apos;ll WhatsApp / email a revised quote within 4 business hours.
        Self-service auto-provisioning coming soon.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Seat change form — fixed-position modal-like card
// ────────────────────────────────────────────────────────────────

function SeatChangeForm({ sub, onClose }: { sub: Sub; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ChangeData>({
    resolver: zodResolver(changeSchema),
    defaultValues: { newSeats: sub.seats, effectiveOn: today },
  });

  async function onSubmit(values: ChangeData) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      toast.error("Session expired");
      return;
    }
    const delta = values.newSeats - sub.seats;
    const body = [
      `Request to change seats on subscription ${sub.id}:`,
      `Current: ${sub.seats} users · ${sub.plan}`,
      `Requested: ${values.newSeats} users (${delta > 0 ? "+" : ""}${delta})`,
      `Effective from: ${values.effectiveOn}`,
      values.note ? `Note: ${values.note}` : null,
    ].filter(Boolean).join("\n");

    const { error } = await supabase.from("support_tickets").insert({
      id:              newTicketId(),
      tenant_id:       sub.tenant_id,
      customer_id:     sub.customer_id,
      customer_name:   sub.customer_name,
      raised_by_email: authData.user.email ?? "",
      raised_by_user:  authData.user.id,
      category:        "plan_change",
      priority:        "normal",
      subject:         `Change seats on ${sub.plan}: ${sub.seats} → ${values.newSeats}`,
      body,
      status:          "open",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request raised · Pardeep will WhatsApp you with a revised quote");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-ink/40 z-40 grid place-items-center p-4" onClick={onClose}>
      <Card className="max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <h2 className="font-serif text-xl text-ink leading-tight">Request seat change</h2>
          <p className="text-xs text-ink-3 mt-1">
            Currently: <b>{sub.seats} users</b> on {sub.plan}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="New seat count" required htmlFor="newSeats">
            <Input
              id="newSeats"
              type="number"
              min={1}
              max={10000}
              error={errors.newSeats?.message}
              {...register("newSeats")}
            />
          </FormField>

          <FormField label="Effective from" required htmlFor="effectiveOn">
            <Input
              id="effectiveOn"
              type="date"
              error={errors.effectiveOn?.message}
              {...register("effectiveOn")}
            />
          </FormField>

          <FormField label="Anything else?" htmlFor="note">
            <Textarea
              id="note"
              rows={3}
              placeholder="e.g., adding 5 marketing users, removing 2 ex-employees..."
              {...register("note")}
            />
          </FormField>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              Submit request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
