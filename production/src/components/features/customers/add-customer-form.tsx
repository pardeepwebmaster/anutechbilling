/**
 * AddCustomerForm — modal dialog to create a new customer.
 *
 * Flow we want Pardeep to use:
 *   1. Type / paste the customer's GSTIN
 *   2. Click "Verify with GSTN" — Sandbox API returns the live business info
 *   3. Click "Fill form from GST" — legal name, address, state, PIN auto-fill
 *   4. Add contact details, save
 *
 * Why this matters: a wrong customer GSTIN means the invoice is invalid
 * — customer can't claim ITC, then a chargeback / complaint comes back to
 * Pardeep. Verifying up front prevents that.
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useCreateCustomer, useUpdateCustomer } from "@/lib/queries/customers";
import {
  isValidGstin,
  validateGstin,
  gstStateFromGstin,
  GST_STATE_BY_CODE,
} from "@/lib/utils";
import GstinVerifyCard from "@/components/features/gstin/gstin-verify-card";
import type { GstinVerification, Customer } from "@/lib/supabase/database.types";

// Schema — GSTIN optional but checksum-validated when present. State code
// stays in the schema (it's needed for GST math) but the visible input
// field is dropped; we auto-derive from GSTIN, same pattern as Settings.
const schema = z.object({
  name:          z.string().min(2, "Company name is required"),
  domain:        z.string().optional(),
  gstin:         z.string().trim().optional().superRefine((v, ctx) => {
    if (!v) return;
    const r = validateGstin(v);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.message });
  }),
  state:         z.string().optional(),
  state_code:    z.string().regex(/^\d{0,2}$/).optional(),
  address:       z.string().optional(),
  pin_code:      z.string().regex(/^\d{0,6}$/, "6-digit PIN (or blank)").optional(),
  contact_name:  z.string().optional(),
  contact_title: z.string().optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddCustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the form opens in EDIT mode (prefilled + updates this customer). */
  customer?: Customer | null;
}

export function AddCustomerForm({ open, onOpenChange, customer }: AddCustomerFormProps) {
  const isEdit = !!customer;
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  // Hold the live verification result so we can persist it with the
  // create call (no extra round-trip).
  const [verification, setVerification] = React.useState<GstinVerification | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  // On open: prefill from the customer (edit) or start blank (create).
  // On close: wipe so reopening starts clean.
  React.useEffect(() => {
    if (!open) {
      reset();
      setVerification(null);
      return;
    }
    if (customer) {
      reset({
        name:          customer.name ?? "",
        domain:        customer.domain ?? "",
        gstin:         customer.gstin ?? "",
        state:         customer.state ?? "",
        state_code:    customer.state_code ?? "",
        address:       customer.address ?? "",
        pin_code:      customer.pin_code ?? "",
        contact_name:  customer.contact_name ?? "",
        contact_title: customer.contact_title ?? "",
        contact_email: customer.contact_email ?? "",
        contact_phone: customer.contact_phone ?? "",
      });
      setVerification(customer.gstin_verification ?? null);
    } else {
      reset({});
      setVerification(null);
    }
  }, [open, customer, reset]);

  // Auto-derive state + state_code from GSTIN on every keystroke. Same
  // logic as Settings — first 2 digits of GSTIN = state code.
  const watchedGstin = watch("gstin");
  React.useEffect(() => {
    const { code, name } = gstStateFromGstin(watchedGstin ?? "");
    if (code) setValue("state_code", code, { shouldDirty: true });
    if (name) setValue("state",      name, { shouldDirty: true });
  }, [watchedGstin, setValue]);

  const onSubmit = async (data: FormData) => {
    const base = {
      name:          data.name.trim(),
      domain:        data.domain?.trim()        || null,
      gstin:         data.gstin?.trim()         || null,
      state:         data.state?.trim()         || null,
      state_code:    data.state_code?.trim()    || null,
      address:       data.address?.trim()       || null,
      pin_code:      data.pin_code?.trim()      || null,
      contact_name:  data.contact_name?.trim()  || null,
      contact_title: data.contact_title?.trim() || null,
      contact_email: data.contact_email?.trim() || null,
      contact_phone: data.contact_phone?.trim() || null,
    };
    // Only stamp verification when newly verified this session — so editing an
    // already-verified customer without re-verifying doesn't wipe its status.
    const payload = verification
      ? { ...base, gstin_verification: verification, gstin_verified_at: new Date().toISOString() }
      : base;
    try {
      if (isEdit && customer) {
        await updateCustomer.mutateAsync({ id: customer.id, patch: payload });
      } else {
        await createCustomer.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] md:max-w-[600px] p-0 flex flex-col overflow-x-hidden"
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit customer" : "Add a customer"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this customer's details. Company name = the customer; contact = the person."
              : "Type the GSTIN first — we'll verify with GSTN and auto-fill the rest."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 min-w-0 w-full"
        >
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* GSTIN — leads the form. Verify card lives directly under it. */}
          <FormField label="GSTIN (recommended)" htmlFor="gstin">
            <Input
              id="gstin"
              placeholder="07ABDCA0298H1ZP"
              className="font-mono uppercase"
              error={errors.gstin?.message}
              {...register("gstin")}
            />
            {(() => {
              const v = (watchedGstin ?? "").trim();
              if (v.length < 15) return (
                <p className="mt-1 text-[10px] text-ink-3">
                  State + code auto-fill from the first 2 digits. Then click Verify with GSTN to confirm + auto-fill.
                </p>
              );
              if (isValidGstin(v)) return (
                <p className="mt-1 text-[10px] text-emerald inline-flex items-center gap-1">
                  <Icon name="check_circle" size={11} /> Format + checksum match. Click Verify to confirm.
                </p>
              );
              const r = validateGstin(v);
              return (
                <p className="mt-1 text-[10px] text-rose inline-flex items-center gap-1">
                  <Icon name="alert" size={11} /> {r.ok ? "" : r.message}
                </p>
              );
            })()}
            <GstinVerifyCard
              gstin={watchedGstin ?? ""}
              cached={verification}
              cachedAt={null}
              noPersist  /* don't save yet — customer doesn't exist; ride payload along on submit */
              onVerified={(v) => setVerification(v)}
              onFillForm={(v) => {
                if (v.legal_name)                  setValue("name",       v.legal_name,                  { shouldDirty: true, shouldValidate: true });
                if (v.address)                     setValue("address",    v.address,                     { shouldDirty: true, shouldValidate: true });
                if (v.principal_address?.pin_code) setValue("pin_code",   v.principal_address.pin_code,  { shouldDirty: true, shouldValidate: true });
                if (v.state_code) {
                  setValue("state_code", v.state_code,                                            { shouldDirty: true, shouldValidate: true });
                  const name = GST_STATE_BY_CODE[v.state_code];
                  if (name) setValue("state",      name,                                          { shouldDirty: true, shouldValidate: true });
                }
              }}
            />
          </FormField>

          {/* Hidden — derived from GSTIN. Kept in form data so GST math
              and invoice PDFs have the canonical 2-digit code on save. */}
          <input type="hidden" {...register("state_code")} />

          {/* Company name — auto-filled by Fill from GST, manually
              editable too. */}
          <FormField label="Company name" required htmlFor="name">
            <Input
              id="name"
              placeholder="Acme Corp Pvt Ltd"
              error={errors.name?.message}
              {...register("name")}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Registered state" htmlFor="state">
              <Input
                id="state"
                placeholder="Auto-filled from GSTIN"
                {...register("state")}
              />
            </FormField>
            <FormField label="PIN code" htmlFor="pin_code">
              <Input
                id="pin_code"
                className="font-mono"
                placeholder="400051"
                maxLength={6}
                error={errors.pin_code?.message}
                {...register("pin_code")}
              />
            </FormField>
          </div>

          <FormField label="Billing address" htmlFor="address">
            <textarea
              id="address"
              rows={2}
              placeholder="Auto-filled from GSTIN — appears on every GST invoice"
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber resize-none"
              {...register("address")}
            />
          </FormField>

          <FormField label="Company website (optional)" htmlFor="domain">
            <Input
              id="domain"
              placeholder="acmecorp.com"
              {...register("domain")}
            />
          </FormField>

          <div className="h-px bg-hairline" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Contact name" htmlFor="contact_name">
              <Input
                id="contact_name"
                placeholder="Rajesh K"
                {...register("contact_name")}
              />
            </FormField>
            <FormField label="Title" htmlFor="contact_title">
              <Input
                id="contact_title"
                placeholder="CTO"
                {...register("contact_title")}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          </div>  {/* close scrollable form body */}

          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting || createCustomer.isPending || updateCustomer.isPending}
            >
              {isEdit ? "Save changes" : "Add customer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
