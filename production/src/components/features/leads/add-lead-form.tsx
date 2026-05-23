/**
 * AddLeadForm — modal dialog to create OR edit a lead.
 *
 * - When `editingLead` is null/undefined → creates a new lead
 * - When `editingLead` is a Lead object  → pre-fills + updates that lead
 *
 * Validates via Zod + React Hook Form.
 *
 * @example
 * // create
 * <AddLeadForm open={open} onOpenChange={setOpen} />
 *
 * // edit
 * <AddLeadForm open={open} onOpenChange={setOpen} editingLead={lead} />
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCreateLead, useUpdateLead } from "@/lib/queries/leads";
import type { Lead } from "@/lib/supabase/database.types";

const STAGES = [
  { value: "new",     label: "New" },
  { value: "contact", label: "Contacted" },
  { value: "demo",    label: "Demo Done" },
  { value: "trial",   label: "Trial Active" },
  { value: "quote",   label: "Quote Sent" },
  { value: "won",     label: "Won" },
  { value: "lost",    label: "Lost" },
] as const;

const SOURCES = [
  { value: "manual",            label: "Added manually" },
  { value: "buy-workspace-v2",  label: "Buy Workspace page" },
  { value: "csv",               label: "CSV import" },
  { value: "whatsapp",          label: "WhatsApp" },
  { value: "referral",          label: "Referral" },
  { value: "google-ads",        label: "Google Ads" },
] as const;

const PLANS = [
  "Google Workspace Starter",
  "Google Workspace Standard",
  "Google Workspace Plus",
  "Google Workspace Enterprise",
  "Microsoft 365 Business Basic",
  "Microsoft 365 Business Standard",
  "Microsoft 365 Business Premium",
  "Zoho Workplace Standard",
  "Zoho Workplace Professional",
  "Plus + Voice add-on",
  "Custom / Mixed",
] as const;

/**
 * Typical Indian reseller MRP per seat per month (INR).
 * Used to auto-calculate annual deal value = price × seats × 12.
 * Plans not in this map (e.g. Custom) skip auto-calculation.
 */
const PLAN_PRICE_PER_SEAT_PM: Record<string, number> = {
  "Google Workspace Starter":          136,
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

// Plan + seats + value are OPTIONAL on the lead schema.
//   • Filled → the lead enters the Deal Pipeline as a qualified deal.
//   • Empty  → the lead lives in the Lead Inbox awaiting qualification.
// This matches the conceptual split: raw inquiries (Inbox) vs qualified
// opportunities (Pipeline). Same DB table, different filter cuts.
const schema = z.object({
  company:       z.string().min(2, "Company name is required"),
  contact_name:  z.string().optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  plan:          z.string().optional().or(z.literal("")),
  seats:         z.coerce.number().int().min(0).max(10000).optional(),
  value:         z.coerce.number().int().min(0).max(100_000_000).optional(),
  stage:         z.enum(["new", "contact", "demo", "trial", "quote", "won", "lost"]),
  source:        z.string(),
  notes:         z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddLeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the form pre-fills + updates this lead instead of creating new. */
  editingLead?: Lead | null;
}

export function AddLeadForm({ open, onOpenChange, editingLead }: AddLeadFormProps) {
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const isEditing  = !!editingLead;

  const [stage, setStage] = React.useState<FormData["stage"]>(
    (editingLead?.stage as FormData["stage"]) ?? "new",
  );
  const [source, setSource] = React.useState<string>(editingLead?.source ?? "manual");
  const [plan, setPlan]     = React.useState<string>(editingLead?.plan ?? "");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editingLead
      ? {
          company:       editingLead.company,
          contact_name:  editingLead.contact_name  ?? "",
          contact_email: editingLead.contact_email ?? "",
          contact_phone: editingLead.contact_phone ?? "",
          plan:          editingLead.plan          ?? "",
          seats:         editingLead.seats         ?? 1,
          value:         editingLead.value         ?? 0,
          stage:        (editingLead.stage  as FormData["stage"]) ?? "new",
          source:        editingLead.source        ?? "manual",
          notes:         editingLead.notes         ?? "",
        }
      : {
          stage: "new",
          source: "manual",
          seats: 10,
          value: 100000,
        },
  });

  const watchedSeats = watch("seats");

  // Auto-calculate annual deal value when plan or seats change.
  // Formula: pricePerSeatPerMonth × seats × 12
  // Skips auto-calc for "Custom / Mixed" or unknown plans.
  React.useEffect(() => {
    const pricePerSeat = PLAN_PRICE_PER_SEAT_PM[plan];
    if (!pricePerSeat || !watchedSeats || watchedSeats < 1) return;
    const annualValue = Math.round(pricePerSeat * watchedSeats * 12);
    setValue("value", annualValue, { shouldValidate: true });
  }, [plan, watchedSeats, setValue]);

  // Reset form when modal closes OR when editingLead changes (re-fills defaults).
  React.useEffect(() => {
    if (!open) {
      reset();
      setStage("new");
      setSource("manual");
      setPlan("");
      return;
    }
    if (editingLead) {
      reset({
        company:       editingLead.company,
        contact_name:  editingLead.contact_name  ?? "",
        contact_email: editingLead.contact_email ?? "",
        contact_phone: editingLead.contact_phone ?? "",
        plan:          editingLead.plan          ?? "",
        seats:         editingLead.seats         ?? 1,
        value:         editingLead.value         ?? 0,
        stage:        (editingLead.stage  as FormData["stage"]) ?? "new",
        source:        editingLead.source        ?? "manual",
        notes:         editingLead.notes         ?? "",
      });
      setStage((editingLead.stage as FormData["stage"]) ?? "new");
      setSource(editingLead.source ?? "manual");
      setPlan(editingLead.plan ?? "");
    }
  }, [open, editingLead, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      // Normalize empties → null so the DB row honors "not qualified yet".
      // A raw lead (no plan/seats/value) lives in Inbox; once these get set,
      // it transitions into the Deal Pipeline.
      const planVal  = data.plan?.trim()  ? data.plan  : null;
      const seatsVal = (data.seats !== undefined && data.seats !== null && !Number.isNaN(data.seats) && data.seats > 0) ? data.seats : null;
      const valueVal = (data.value !== undefined && data.value !== null && !Number.isNaN(data.value) && data.value > 0) ? data.value : null;

      if (isEditing && editingLead) {
        // ─── Update existing lead ───
        await updateLead.mutateAsync({
          id: editingLead.id,
          patch: {
            company:       data.company,
            contact_name:  data.contact_name  || null,
            contact_email: data.contact_email || null,
            contact_phone: data.contact_phone || null,
            plan:          planVal,
            seats:         seatsVal,
            value:         valueVal,
            stage:         data.stage,
            source:        data.source,
            notes:         data.notes || null,
          },
        });
      } else {
        // ─── Create new lead ───
        const id = "L-" + Date.now().toString(36).toUpperCase();
        await createLead.mutateAsync({
          id,
          company:       data.company,
          contact_name:  data.contact_name  || null,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          plan:          planVal,
          seats:         seatsVal,
          value:         valueVal,
          stage:         data.stage,
          source:        data.source,
          notes:         data.notes || null,
        });
      }
      onOpenChange(false);
    } catch {
      // Error toast handled in mutation hooks' onError
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit lead" : "Add a new lead"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${editingLead?.company}.`
              : "Track a potential deal. You can update stage anytime via drag-drop."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Company name */}
          <FormField label="Company name" required htmlFor="company">
            <Input
              id="company"
              autoFocus
              placeholder="Acme Corp Pvt Ltd"
              error={errors.company?.message}
              {...register("company")}
            />
          </FormField>

          {/* Contact info — 3 fields in grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Contact name" htmlFor="contact_name">
              <Input
                id="contact_name"
                placeholder="Rajesh K"
                {...register("contact_name")}
              />
            </FormField>
            <FormField label="Email" htmlFor="contact_email">
              <Input
                id="contact_email"
                type="email"
                placeholder="rajesh@acme.com"
                error={errors.contact_email?.message}
                {...register("contact_email")}
              />
            </FormField>
            <FormField label="Phone" htmlFor="contact_phone">
              <Input
                id="contact_phone"
                placeholder="+91 98765 43210"
                {...register("contact_phone")}
              />
            </FormField>
          </div>

          {/* Plan — optional. If empty → lead lands in Inbox (raw, awaiting
              qualification). If picked → lead enters Pipeline as a deal. */}
          <FormField label="Interested plan" htmlFor="plan">
            <Select
              value={plan}
              onValueChange={(v) => {
                setPlan(v);
                (register("plan") as any).onChange({ target: { value: v, name: "plan" } });
              }}
            >
              <SelectTrigger id="plan" error={!!errors.plan}>
                <SelectValue placeholder="Skip to capture as raw lead (Inbox)" />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register("plan")} value={plan} />
            <p className="text-[11px] text-ink-3 mt-1">
              {plan
                ? "Will go straight into Deal Pipeline as a qualified opportunity."
                : "Leave empty to drop into Lead Inbox — you can qualify later."}
            </p>
          </FormField>

          {/* Seats + Value in grid — both optional now */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Seats" htmlFor="seats">
              <Input
                id="seats"
                type="number"
                min={0}
                placeholder="—"
                error={errors.seats?.message}
                {...register("seats", { valueAsNumber: true, setValueAs: (v) => v === "" || v === null ? undefined : Number(v) })}
              />
            </FormField>
            <FormField label="Deal value (₹)" htmlFor="value">
              <Input
                id="value"
                type="text"
                inputMode="numeric"
                prefix="₹"
                error={errors.value?.message}
                {...register("value")}
              />
              {/* Auto-calc hint */}
              {PLAN_PRICE_PER_SEAT_PM[plan] && (watchedSeats ?? 0) >= 1 && (
                <p className="mt-1 text-xs text-ink-3">
                  ₹{PLAN_PRICE_PER_SEAT_PM[plan].toLocaleString("en-IN")}/seat/mo
                  {" × "}{watchedSeats} seats × 12 mo
                  {" = "}
                  <span className="font-semibold text-ink">
                    ₹{(PLAN_PRICE_PER_SEAT_PM[plan] * (watchedSeats ?? 0) * 12).toLocaleString("en-IN")}
                  </span>
                </p>
              )}
              {plan === "Custom / Mixed" && (
                <p className="mt-1 text-xs text-ink-3">Enter your negotiated deal value</p>
              )}
            </FormField>
          </div>

          {/* Stage + Source */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Stage" required htmlFor="stage">
              <Select
                value={stage}
                onValueChange={(v) => {
                  setStage(v as FormData["stage"]);
                  (register("stage") as any).onChange({ target: { value: v, name: "stage" } });
                }}
              >
                <SelectTrigger id="stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" {...register("stage")} value={stage} />
            </FormField>
            <FormField label="Source" htmlFor="source">
              <Select
                value={source}
                onValueChange={(v) => {
                  setSource(v);
                  (register("source") as any).onChange({ target: { value: v, name: "source" } });
                }}
              >
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" {...register("source")} value={source} />
            </FormField>
          </div>

          {/* Notes */}
          <FormField label="Notes (optional)" htmlFor="notes">
            <Input
              id="notes"
              placeholder="Decision maker, timeline, budget…"
              {...register("notes")}
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting || createLead.isPending || updateLead.isPending}
            >
              {isEditing ? "Save changes" : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
