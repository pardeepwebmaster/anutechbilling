/**
 * AddExpenseDialog — capture an operating expense.
 *
 * Optional GST paid → flows into the input tax credit report.
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
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  useCreateExpense,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
} from "@/lib/queries/expenses";

const schema = z.object({
  category:       z.string().min(2),
  vendor_name:    z.string().optional(),
  expense_date:   z.string().min(10, "Date required"),
  amount:         z.coerce.number().min(1, "Amount required"),
  gst_paid:       z.coerce.number().min(0).default(0),
  payment_method: z.string().optional(),
  description:    z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function AddExpenseDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateExpense();
  const today  = new Date().toISOString().slice(0, 10);

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      expense_date: today,
      category: "Hosting",
      payment_method: "bank_transfer",
      amount: 0,
      gst_paid: 0,
    },
  });

  async function onSubmit(values: FormData) {
    await create.mutateAsync({
      category:       values.category,
      vendor_name:    values.vendor_name    || null,
      expense_date:   values.expense_date,
      amount:         Math.round(values.amount),
      gst_paid:       Math.round(values.gst_paid),
      payment_method: values.payment_method || null,
      description:    values.description    || null,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Operating expense — hosting, software, salaries, office, marketing, etc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Category" required htmlFor="category">
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger id="category"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Date" required htmlFor="expense_date">
              <Input id="expense_date" type="date" error={errors.expense_date?.message} {...register("expense_date")} />
            </FormField>
          </div>

          <FormField label="Vendor / payee (optional)" htmlFor="vendor_name">
            <Input id="vendor_name" placeholder="Cloud Run / Resend / Office Landlord" {...register("vendor_name")} />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Amount (₹) incl GST" required htmlFor="amount">
              <Input id="amount" type="number" min={1} step={1} error={errors.amount?.message} {...register("amount")} />
            </FormField>
            <FormField label="GST paid (₹, if invoiced)" htmlFor="gst_paid">
              <Input id="gst_paid" type="number" min={0} step={1} {...register("gst_paid")} />
              <p className="text-[10px] text-ink-3 mt-1">Claimable as input tax credit.</p>
            </FormField>
          </div>

          <FormField label="Payment method" htmlFor="payment_method">
            <Select value={watch("payment_method")} onValueChange={(v) => setValue("payment_method", v)}>
              <SelectTrigger id="payment_method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Description (optional)" htmlFor="description">
            <Textarea id="description" rows={2} placeholder="Reference, period, comments…" {...register("description")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>Save expense</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
