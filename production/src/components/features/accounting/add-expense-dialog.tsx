/**
 * AddExpenseDialog — capture an operating expense.
 *
 * Optional GST paid → flows into the input tax credit report.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Icon } from "@/components/ui/icon";
import {
  useCreateExpense,
  useUpdateExpense,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type Expense,
} from "@/lib/queries/expenses";
import { useBankAccounts } from "@/lib/queries/bank";
import { useVendors, ensureVendor } from "@/lib/queries/vendors";

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

export function AddExpenseDialog({ onClose, expense }: { onClose: () => void; expense?: Expense | null }) {
  const router = useRouter();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const isEdit = Boolean(expense);
  const today  = new Date().toISOString().slice(0, 10);
  const { data: bankAccounts } = useBankAccounts();
  const cashAccounts = (bankAccounts ?? []).filter((a) => a.account_type === "cash");
  const [pettyCashAccountId, setPettyCashAccountId] = React.useState<string>("");

  // Vendor master link — pick an existing supplier or type a new one (auto-added
  // to Vendors on save), so every OPEX supplier is a managed vendor too.
  const { data: vendors } = useVendors();
  const [vendorId, setVendorId] = React.useState<string | null>(expense?.vendor_id ?? null);
  const [vendorOpen, setVendorOpen] = React.useState(false);

  // ── AI bill reader — upload a stationery/software/rent invoice → Gemini
  //    extracts the fields → we PRE-FILL (operator verifies before saving).
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [aiNote, setAiNote]   = React.useState<string | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);

  async function handleBillFile(file: File) {
    setAiError(null); setAiNote(null);
    if (file.size > 8 * 1024 * 1024) { setAiError("File is too big (max 8 MB) — try a smaller photo."); return; }
    setReading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve((r.result as string).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/ai/extract-bill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mimeType: file.type }),
      });
      const json = await res.json();
      if (!res.ok) { setAiError(json.error ?? "Couldn't read the bill."); return; }
      const f = json.fields as Record<string, unknown>;
      if (f.vendor_name) setValue("vendor_name", String(f.vendor_name));
      if (f.bill_date)   setValue("expense_date", String(f.bill_date));
      const cur = String(f.currency ?? "INR");
      const gst = Number(f.cgst ?? 0) + Number(f.sgst ?? 0) + Number(f.igst ?? 0);
      if (cur === "INR") {
        if (f.total != null) setValue("amount", Math.round(Number(f.total)));
        setValue("gst_paid", Math.round(gst));
        setAiNote("AI ne bhar diya — sahi category chuno aur amounts bill se milaa ke Save karo.");
      } else {
        // Foreign bill: books are ₹, so don't push a raw foreign number into amount.
        setAiNote(`Bill ${cur} me hai — vendor & date bhar diye. ₹ amount + GST khud daalo (aaj ke rate se).`);
      }
    } catch {
      setAiError("Upload failed — try again, ya fields haath se bhar do.");
    } finally {
      setReading(false);
    }
  }

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: expense
      ? {
          expense_date:   expense.expense_date,
          category:       expense.category,
          vendor_name:    expense.vendor_name ?? "",
          amount:         expense.amount,
          gst_paid:       expense.gst_paid,
          payment_method: expense.payment_method ?? "bank_transfer",
          description:    expense.description ?? "",
        }
      : {
          expense_date: today,
          category: "Hosting",
          payment_method: "bank_transfer",
          amount: 0,
          gst_paid: 0,
        },
  });

  async function onSubmit(values: FormData) {
    const payee = values.vendor_name?.trim() || "";
    // Only GST-invoice suppliers belong in the Vendors master. So: an already-
    // picked vendor keeps its link; a NEW typed payee is added to Vendors only
    // when this is a GST bill (GST paid entered). Non-GST / one-off payees stay
    // as a free-text name and don't clutter the supplier master.
    const isGstBill = Number(values.gst_paid) > 0;
    const vId = payee
      ? (vendorId ?? (isGstBill ? await ensureVendor({ name: payee, defaultCategory: values.category }) : null))
      : null;

    if (expense) {
      // Edit updates the expense row's fields only. (A linked petty-cash leg,
      // if any, isn't re-adjusted here — edit amount changes cautiously.)
      await update.mutateAsync({
        id: expense.id,
        patch: {
          category:       values.category,
          vendor_name:    payee || null,
          vendor_id:      vId,
          expense_date:   values.expense_date,
          amount:         Math.round(values.amount),
          gst_paid:       Math.round(values.gst_paid),
          payment_method: values.payment_method || null,
          description:    values.description    || null,
        },
      });
      onClose();
      return;
    }
    await create.mutateAsync({
      category:       values.category,
      vendor_name:    payee || null,
      vendor_id:      vId,
      expense_date:   values.expense_date,
      amount:         Math.round(values.amount),
      gst_paid:       Math.round(values.gst_paid),
      payment_method: values.payment_method || null,
      description:    values.description    || null,
      // Only tag a petty-cash out-flow when paid by cash from a chosen account.
      pettyCashAccountId: values.payment_method === "cash" ? (pettyCashAccountId || null) : null,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>
            Operating expense — hosting, software, salaries, office, marketing, etc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isEdit && (
            <div className="rounded-lg border border-dashed border-amber/50 bg-amber-soft/20 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="sparkles" size={18} className="text-amber-ink shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Bill upload karo — AI khud bhar dega</p>
                    <p className="text-[11px] text-ink-3">Photo/PDF — stationery, software, rent, koi bhi expense bill</p>
                  </div>
                </div>
                <Button type="button" variant="primary" size="sm" icon="upload" loading={reading} onClick={() => fileRef.current?.click()}>
                  {reading ? "Reading…" : "Upload bill"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBillFile(f); e.target.value = ""; }}
                />
              </div>
              {aiNote && <p className="mt-2 flex items-start gap-1.5 text-[11px] text-emerald"><Icon name="check_circle" size={12} className="mt-0.5 shrink-0" /> {aiNote}</p>}
              {aiError && <p className="mt-2 flex items-start gap-1.5 text-[11px] text-rose"><Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {aiError}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Category" required htmlFor="category">
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger id="category"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {/* Salaries aren't a plain expense — they're booked in Payroll
                      (payslip + statutory). Only show it if editing a legacy one. */}
                  {EXPENSE_CATEGORIES
                    .filter((c) => c !== "Salaries" || expense?.category === "Salaries")
                    .map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Date" required htmlFor="expense_date">
              <Input id="expense_date" type="date" error={errors.expense_date?.message} {...register("expense_date")} />
            </FormField>
          </div>
          {!isEdit && (
            <p className="-mt-1 text-[11px] text-ink-3 leading-relaxed">
              Paying a salary?{" "}
              <button
                type="button"
                onClick={() => { onClose(); router.push("/accounting/payroll" as never); }}
                className="text-amber-ink font-medium underline hover:no-underline"
              >
                Book it in Payroll &amp; Leave →
              </button>{" "}
              so it gets a payslip + statutory handling (and posts the Salaries expense for you).
            </p>
          )}

          <FormField label="Vendor / payee (optional)" htmlFor="vendor_name">
            <div className="relative">
              <Input
                id="vendor_name"
                autoComplete="off"
                placeholder="e.g. Anthropic / Airtel / Office Landlord"
                {...register("vendor_name", { onChange: () => { setVendorId(null); setVendorOpen(true); } })}
                onFocus={() => setVendorOpen(true)}
                onBlur={() => setTimeout(() => setVendorOpen(false), 130)}
              />
              {vendorOpen && (vendors ?? []).length > 0 && (() => {
                const query = (watch("vendor_name") || "").trim().toLowerCase();
                const matches = (vendors ?? []).filter((v) => !query || v.name.toLowerCase().includes(query)).slice(0, 8);
                if (matches.length === 0) return null;
                return (
                  <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-hairline bg-paper shadow-lg">
                    {matches.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setValue("vendor_name", v.name); setVendorId(v.id); setVendorOpen(false); }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-paper-2"
                      >
                        <span className="text-ink truncate">{v.name}</span>
                        {v.gstin && <span className="text-[10px] text-ink-3 font-mono shrink-0">{v.gstin}</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            <p className="text-[10px] text-ink-3 mt-1">Pick an existing vendor, or type a new one — a new payee is added to your Vendors master only when it&apos;s a GST bill (GST paid entered).</p>
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

          {/* Petty-cash link — only when paid by cash and a cash account exists.
              Picking one deducts this expense from that account's cash-in-hand. */}
          {!isEdit && watch("payment_method") === "cash" && cashAccounts.length > 0 && (
            <FormField label="Paid from petty cash" htmlFor="petty_cash">
              <Select value={pettyCashAccountId || "none"} onValueChange={(v) => setPettyCashAccountId(v === "none" ? "" : v)}>
                <SelectTrigger id="petty_cash"><SelectValue placeholder="Don't deduct from petty cash" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don&apos;t deduct from petty cash</SelectItem>
                  {cashAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-ink-3 mt-1">
                Deducts this amount from the petty-cash balance (cash in hand).
              </p>
            </FormField>
          )}

          <FormField label="Description (optional)" htmlFor="description">
            <Textarea id="description" rows={2} placeholder="Reference, period, comments…" {...register("description")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>{isEdit ? "Save changes" : "Save expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
