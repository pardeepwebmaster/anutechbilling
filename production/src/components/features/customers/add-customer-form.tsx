/**
 * AddCustomerForm — modal dialog to create a new customer.
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
import { useCreateCustomer } from "@/lib/queries/customers";
import { isValidGstin } from "@/lib/utils";

const STATES = [
  { value: "27", label: "Maharashtra (27)" },
  { value: "29", label: "Karnataka (29)" },
  { value: "33", label: "Tamil Nadu (33)" },
  { value: "07", label: "Delhi (07)" },
  { value: "24", label: "Gujarat (24)" },
  { value: "06", label: "Haryana (06)" },
  { value: "09", label: "Uttar Pradesh (09)" },
  { value: "19", label: "West Bengal (19)" },
  { value: "36", label: "Telangana (36)" },
  { value: "32", label: "Kerala (32)" },
] as const;

const schema = z.object({
  name:          z.string().min(2, "Company name is required"),
  domain:        z.string().optional(),
  gstin:         z.string().optional().refine(
    (v) => !v || isValidGstin(v),
    "Invalid GSTIN format"
  ),
  state_code:    z.string(),
  contact_name:  z.string().optional(),
  contact_title: z.string().optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddCustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCustomerForm({ open, onOpenChange }: AddCustomerFormProps) {
  const createCustomer = useCreateCustomer();
  const [stateCode, setStateCode] = React.useState("27");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { state_code: "27" },
  });

  React.useEffect(() => {
    if (!open) {
      reset();
      setStateCode("27");
    }
  }, [open, reset]);

  const onSubmit = async (data: FormData) => {
    const stateLabel = STATES.find((s) => s.value === data.state_code)?.label;
    try {
      await createCustomer.mutateAsync({
        name: data.name,
        domain: data.domain || null,
        gstin: data.gstin || null,
        state: stateLabel ?? null,
        state_code: data.state_code,
        contact_name: data.contact_name || null,
        contact_title: data.contact_title || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
      });
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a customer</DialogTitle>
          <DialogDescription>
            Create a customer record. GSTIN is optional but enables auto e-invoice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Company name */}
          <FormField label="Company name" required htmlFor="name">
            <Input
              id="name"
              autoFocus
              placeholder="Acme Corp Pvt Ltd"
              error={errors.name?.message}
              {...register("name")}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Domain" htmlFor="domain">
              <Input
                id="domain"
                placeholder="acmecorp.com"
                {...register("domain")}
              />
            </FormField>
            <FormField label="GSTIN" htmlFor="gstin">
              <Input
                id="gstin"
                placeholder="27AABCE9876D1Z3"
                className="font-mono uppercase"
                error={errors.gstin?.message}
                {...register("gstin")}
              />
            </FormField>
          </div>

          <FormField label="State" required htmlFor="state_code">
            <Select
              value={stateCode}
              onValueChange={(v) => {
                setStateCode(v);
                (register("state_code") as any).onChange({ target: { value: v, name: "state_code" } });
              }}
            >
              <SelectTrigger id="state_code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register("state_code")} value={stateCode} />
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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting || createCustomer.isPending}
            >
              Add customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
