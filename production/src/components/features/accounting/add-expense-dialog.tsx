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
import { FormField } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn, rupee, formatForeignAmount } from "@/lib/utils";
import {
  useCreateExpense,
  useUpdateExpense,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type Expense,
} from "@/lib/queries/expenses";
import { useBankAccounts } from "@/lib/queries/bank";
import { useVendors, ensureVendor } from "@/lib/queries/vendors";
import { uploadBillAttachment } from "@/lib/queries/vendor-bills";

const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"] as const;

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

  // Currency of the bill. Books are ₹, so a foreign bill needs an exchange rate;
  // amount/GST are entered in `currency` and converted to ₹ on save (rate=₹/unit).
  const [currency, setCurrency] = React.useState(expense?.currency ?? "INR");
  const [fxRate, setFxRate]     = React.useState(expense?.fx_rate && expense.fx_rate !== 1 ? String(expense.fx_rate) : "");
  const [fxError, setFxError]   = React.useState<string | null>(null);
  const isForeign = currency !== "INR";
  const rate = isForeign ? Number(fxRate || 0) : 1;

  // How the expense is supported: proper GST tax invoice, a kaccha (informal /
  // non-GST) bill, or no bill at all (petty cash). Only a GST invoice carries
  // input tax credit — and only a GST-invoice vendor joins the Vendors master.
  const [billType, setBillType] = React.useState<string>(expense?.bill_type ?? "gst");
  const isGstBill = billType === "gst";

  // Payroll / statutory postings (salary, employer ESI/PF, TDS) come from the
  // Payroll module — they have no bill or line items, so we hide the items
  // editor when editing one. (New expenses can't be salaries — the category is
  // filtered out — so this only matters on edit.)
  const isPayroll = Boolean(expense && (
    expense.category === "Salaries" ||
    expense.payment_method === "statutory" ||
    /\b(ESI|EPF|PF|Provident|Gratuity|Bonus|TDS)\b/i.test(expense.category)
  ));

  // Line items on the bill (e.g. an Anthropic / software invoice lists several).
  // Amounts stay in the bill's OWN currency, faithful to the document; the ₹
  // books use the converted `amount`. Same shape + behaviour as COGS bills.
  type Line = { description: string; qty: string; unit_price: string; amount: string };
  const [lines, setLines] = React.useState<Line[]>(
    (expense?.line_items ?? []).map((li) => ({
      description: li.name ?? "",
      qty:         li.qty        != null ? String(li.qty)        : "",
      unit_price:  li.rate       != null ? String(li.rate)       : "",
      amount:      li.amount     != null ? String(li.amount)     : "",
    })),
  );
  const addLine    = () => setLines((ls) => [...ls, { description: "", qty: "", unit_price: "", amount: "" }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const setLine    = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // ── AI bill reader — upload a stationery/software/rent invoice → Gemini
  //    extracts the fields → we PRE-FILL (operator verifies before saving).
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [aiNote, setAiNote]   = React.useState<string | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  // The uploaded bill file — kept and attached to the expense on save (proof),
  // whether or not the AI read is confirmed.
  const [attachFile, setAttachFile] = React.useState<File | null>(null);
  // What the AI extracted, held for the operator to CONFIRM before anything is
  // written into the form. Nothing auto-fills — a mis-read bill must never
  // silently push wrong amounts/items into a money entry. null = no pending read.
  type PendingExtract = {
    vendorName?: string;
    billDate?:   string;
    currency:    string;
    total?:      number;
    gst:         number;
    billType:    "gst" | "kaccha";
    items:       { description: string; qty: string; unit_price: string; amount: string }[];
  };
  const [pending, setPending] = React.useState<PendingExtract | null>(null);

  async function handleBillFile(file: File) {
    setAiError(null); setAiNote(null); setPending(null);
    if (file.size > 8 * 1024 * 1024) { setAiError("File is too big (max 8 MB) — try a smaller photo."); return; }
    setAttachFile(file);   // keep it — attaches to the expense on save (proof)
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
      if (!res.ok) { setAiError(json.error ?? "Couldn't read the bill — fields haath se bhar do. 📎 bill attach ho jayega."); return; }
      const f = json.fields as Record<string, unknown>;
      const cur = String(f.currency ?? "INR").toUpperCase();
      const gst = Number(f.cgst ?? 0) + Number(f.sgst ?? 0) + Number(f.igst ?? 0);
      const items = Array.isArray(f.line_items) ? (f.line_items as Array<Record<string, unknown>>) : [];
      // Hold the read for the operator to CONFIRM — nothing fills the form yet.
      setPending({
        vendorName: f.vendor_name ? String(f.vendor_name) : undefined,
        billDate:   f.bill_date   ? String(f.bill_date)   : undefined,
        currency:   cur,
        total:      f.total != null ? Number(f.total) : undefined,
        gst,
        billType:   gst > 0 ? "gst" : "kaccha",
        items: items.map((it) => ({
          description: String(it.description ?? ""),
          qty:         it.qty        != null ? String(it.qty)        : "",
          unit_price:  it.unit_price != null ? String(it.unit_price) : "",
          amount:      it.amount     != null ? String(it.amount)     : "",
        })),
      });
    } catch {
      setAiError("Upload failed — try again, ya fields haath se bhar do.");
    } finally {
      setReading(false);
    }
  }

  // Operator confirmed the read is correct → fill the form (header + items).
  function applyExtract() {
    if (!pending) return;
    if (pending.vendorName) setValue("vendor_name", pending.vendorName);
    if (pending.billDate)   setValue("expense_date", pending.billDate);
    setBillType(pending.billType);
    setCurrency(pending.currency);
    if (pending.total != null) setValue("amount", pending.total);
    setValue("gst_paid", pending.gst);
    setLines(pending.items);
    if (pending.currency !== "INR") {
      setFxRate("");   // force today's rate before it hits the ₹ books
      setAiNote(`Bhar diya · bill ${pending.currency} me hai — neeche exchange rate (₹/${pending.currency}) daalo, phir Save. 📎 bill attach ho jayega.`);
    } else {
      setAiNote("Bhar diya — amounts bill se milaa ke Save karo. 📎 bill attach ho jayega.");
    }
    setPending(null);
  }

  // Operator says the read is wrong / wants to enter manually → discard the
  // extraction (NO items, NO amounts auto-added), but keep the bill attached.
  function discardExtract() {
    setPending(null);
    setAiNote(`Theek — fields aur items khud bhar do. 📎 "${attachFile?.name ?? "bill"}" expense ke saath attach ho jayega.`);
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
          // Foreign expense: show amounts in the bill's currency (₹ ÷ rate).
          amount:         expense.currency !== "INR" && expense.fx_rate ? Math.round((expense.amount / expense.fx_rate) * 100) / 100 : expense.amount,
          gst_paid:       expense.currency !== "INR" && expense.fx_rate ? Math.round((expense.gst_paid / expense.fx_rate) * 100) / 100 : expense.gst_paid,
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
    // Only a GST invoice adds a NEW payee to the Vendors master + carries GST.
    const vId = payee
      ? (vendorId ?? (isGstBill ? await ensureVendor({ name: payee, defaultCategory: values.category }) : null))
      : null;

    // Foreign bill must have an exchange rate before it hits the ₹ books.
    if (isForeign && rate <= 0) {
      setFxError(`Enter today's exchange rate (₹ per 1 ${currency}) to save — the ₹ books need it.`);
      return;
    }
    setFxError(null);
    const inr = (n: number) => Math.round(n * rate);   // convert entered currency → ₹ (rate 1 for INR)
    // No input GST on a kaccha / no-bill expense.
    const gstAmt = isGstBill ? inr(values.gst_paid) : 0;

    // Line items — keep amounts in the bill's OWN currency (faithful to the
    // document); drop blank rows. Same shape as COGS bills (VendorBillLine).
    const line_items = lines
      .map((l) => ({
        name:   l.description.trim(),
        qty:    l.qty ? Number(l.qty) : undefined,
        rate:   l.unit_price ? Number(l.unit_price) : undefined,
        amount: Number(l.amount || 0),
      }))
      .filter((l) => l.name || l.amount > 0);

    // Attach the uploaded bill (proof) — non-fatal if the upload hiccups; the
    // expense still saves. Keep any existing attachment on edit if no new file.
    let attachment_url: string | null = expense?.attachment_url ?? null;
    if (attachFile) {
      try { attachment_url = await uploadBillAttachment(attachFile); }
      catch { /* keep saving the expense even if the file upload fails */ }
    }

    if (expense) {
      // Edit updates the expense row's fields only. (A linked petty-cash leg,
      // if any, isn't re-adjusted here — edit amount changes cautiously.)
      await update.mutateAsync({
        id: expense.id,
        patch: {
          category:       values.category,
          vendor_name:    payee || null,
          vendor_id:      vId,
          currency,
          fx_rate:        rate,
          bill_type:      billType,
          line_items,
          attachment_url,
          expense_date:   values.expense_date,
          amount:         inr(values.amount),
          gst_paid:       gstAmt,
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
      currency,
      fx_rate:        rate,
      bill_type:      billType,
      line_items,
      attachment_url,
      expense_date:   values.expense_date,
      amount:         inr(values.amount),
      gst_paid:       gstAmt,
      payment_method: values.payment_method || null,
      description:    values.description    || null,
      // Only tag a petty-cash out-flow when paid by cash from a chosen account.
      pettyCashAccountId: values.payment_method === "cash" ? (pettyCashAccountId || null) : null,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            A running-the-business cost — rent, software, stationery, etc. (Products you resell → COGS Bills.)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* What was this for — a short, human note first (e.g. "Team lunch"). */}
          <FormField label="What was this for?" htmlFor="description">
            <Input id="description" placeholder="e.g. Team lunch · office snacks · cab fare · courier" {...register("description")} />
          </FormField>

          {/* ── Expense details — category/date + bill & amount, one card ── */}
          <section className="rounded-lg border border-hairline bg-paper-2/30 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Category" required htmlFor="category">
                <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                  <SelectTrigger id="category"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {/* Salaries are booked in Payroll (payslip + statutory) — hide unless editing a legacy one. */}
                    {EXPENSE_CATEGORIES
                      .filter((c) => c !== "Salaries" || expense?.category === "Salaries")
                      .map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Date" required htmlFor="expense_date">
                <Input id="expense_date" type="date" error={errors.expense_date?.message} {...register("expense_date")} />
              </FormField>
            </div>
            {!isEdit && (
              <p className="text-[11px] text-ink-3 leading-relaxed">
                Paying a salary?{" "}
                <button type="button" onClick={() => { onClose(); router.push("/accounting/payroll" as never); }}
                  className="text-amber-ink font-medium underline hover:no-underline">Book it in Payroll &amp; Leave →</button>{" "}
                so it gets a payslip + statutory handling.
              </p>
            )}

            <div className="border-t border-hairline pt-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Bill &amp; amount</p>

            {/* Bill type — segmented; drives GST input-credit + vendor-master */}
            <div>
              <div className="grid grid-cols-3 gap-1.5">
                {([["gst", "GST invoice"], ["kaccha", "Kaccha bill"], ["none", "No bill"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setBillType(val); if (val !== "gst") { setValue("gst_paid", 0); setVendorId(null); } }}
                    className={cn(
                      "rounded-md border px-2 py-2 text-[12px] font-medium transition-colors text-center",
                      billType === val ? "border-amber bg-amber-soft text-amber-ink" : "border-hairline text-ink-2 hover:bg-paper-2",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={cn("mt-1.5 text-[10px] leading-snug", isGstBill ? "text-ink-3" : "text-amber-ink")}>
                {isGstBill
                  ? "Proper GST tax invoice — input GST is claimable, and the vendor is saved to your Vendors master."
                  : "Recorded & income-tax deductible — but no input GST credit (that needs a GST tax invoice)."}
              </p>
            </div>

            {/* AI bill reader — only when there IS a bill (GST / kaccha). Upload a
                photo/PDF → AI reads it → you confirm before it fills the form. */}
            {billType !== "none" && (
              <div className="rounded-md border border-dashed border-amber/50 bg-amber-soft/15 p-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="sparkles" size={16} className="text-amber-ink shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink">Bill upload karo — AI khud bhar dega</p>
                      <p className="text-[10px] text-ink-3">Photo/PDF — AI fields + items nikaal dega, aap confirm karke Save karo</p>
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

                {/* Confirmation gate — AI read something; the operator must confirm
                    it's correct before it fills the form. Nothing auto-applies. */}
                {pending && (() => {
                  const fmt = (n: number) => pending.currency !== "INR" ? (formatForeignAmount(pending.currency, n) ?? `${pending.currency} ${n}`) : rupee(n);
                  return (
                    <div className="mt-2.5 rounded-md border border-amber/40 bg-paper p-3">
                      <p className="text-[12px] font-medium text-ink mb-2">
                        AI ne ye padha — sahi hai? Confirm karo tabhi bharega.
                      </p>
                      <div className="space-y-1 text-[12px] text-ink-2">
                        <div className="flex justify-between gap-2"><span className="text-ink-3">Vendor</span><span className="text-ink text-right">{pending.vendorName || "—"}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-ink-3">Bill date</span><span className="text-right">{pending.billDate || "—"}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-ink-3">Type</span><span className="text-right">{pending.billType === "gst" ? "GST invoice" : "Kaccha (no GST)"}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-ink-3">Total{pending.currency !== "INR" ? ` (${pending.currency})` : ""}</span><span className="font-mono text-ink text-right">{pending.total != null ? fmt(pending.total) : "—"}{pending.gst > 0 ? ` · GST ${fmt(pending.gst)}` : ""}</span></div>
                      </div>
                      {pending.items.length > 0 && (
                        <div className="mt-2 border-t border-hairline pt-2">
                          <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">{pending.items.length} item{pending.items.length > 1 ? "s" : ""}</p>
                          <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                            {pending.items.map((it, i) => (
                              <li key={i} className="flex justify-between gap-2 text-[11px]">
                                <span className="text-ink-2 truncate">{it.description || "—"}{it.qty ? ` × ${it.qty}` : ""}</span>
                                <span className="font-mono text-ink-3 shrink-0">{it.amount ? fmt(Number(it.amount)) : "—"}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="primary" size="sm" icon="check" onClick={applyExtract}>Haan, sahi hai — bhar do</Button>
                        <Button type="button" variant="default" size="sm" onClick={discardExtract}>Galat — main khud bharunga</Button>
                      </div>
                      <p className="mt-2 text-[10px] text-ink-3">Kaise bhi karo, 📎 &ldquo;{attachFile?.name}&rdquo; bill expense ke saath attach ho jayega.</p>
                    </div>
                  );
                })()}

                {/* File kept but read not pending (confirmed or entering manually). */}
                {attachFile && !pending && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-2">
                    <Icon name="file" size={12} /> {attachFile.name} — expense ke saath attach hoga
                  </p>
                )}
              </div>
            )}

            {/* Vendor / payee — sits right below the bill upload, since reading
                the invoice auto-fills the vendor + its tax/GST details. */}
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
                        <button key={v.id} type="button"
                          onMouseDown={(e) => { e.preventDefault(); setValue("vendor_name", v.name); setVendorId(v.id); setVendorOpen(false); }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-paper-2">
                          <span className="text-ink truncate">{v.name}</span>
                          {v.gstin && <span className="text-[10px] text-ink-3 font-mono shrink-0">{v.gstin}</span>}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </FormField>

            {/* Line items — what's on the bill (auto-filled from the AI scan).
                Hidden for payroll/statutory postings, which have no items. */}
            {!isPayroll && (
            <div className="rounded-md border border-hairline bg-paper/60 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                  Items on this bill{isForeign ? ` · in ${currency}` : ""}
                </p>
                <Button type="button" variant="ghost" size="sm" icon="plus" onClick={addLine}>Add item</Button>
              </div>
              {lines.length === 0 ? (
                <p className="text-[11px] text-ink-3">Optional — upload a bill to auto-fill, or add rows to itemise (e.g. per-seat plan lines).</p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-ink-3">
                    <span className="col-span-5">Description</span>
                    <span className="col-span-2 text-right">Qty</span>
                    <span className="col-span-2 text-right">Unit price</span>
                    <span className="col-span-2 text-right">Amount</span>
                    <span className="col-span-1" />
                  </div>
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input wrapperClassName="col-span-12 sm:col-span-5" placeholder="e.g. Team plan - Premium"
                        value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                      <Input wrapperClassName="col-span-3 sm:col-span-2" className="text-right" type="number" min={0} step="any" placeholder="Qty"
                        value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                      <Input wrapperClassName="col-span-3 sm:col-span-2" className="text-right" type="number" step="any" placeholder="Unit"
                        value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} />
                      {/* Amount allows negatives — credit / unused-time lines on a
                          proration invoice are refunds (e.g. -$61.41). */}
                      <Input wrapperClassName="col-span-3 sm:col-span-2" className="text-right" type="number" step="any" placeholder="Amount"
                        value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                      <button type="button" onClick={() => removeLine(i)} aria-label="Remove item"
                        className="col-span-3 sm:col-span-1 justify-self-center text-ink-3 hover:text-rose">
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Currency + amount + GST */}
            <div className="grid grid-cols-12 gap-3">
              <FormField label="Currency" htmlFor="currency" className="col-span-4 sm:col-span-3">
                <Select value={currency} onValueChange={(v) => { setCurrency(v); if (v === "INR") setFxError(null); }}>
                  <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={`Amount (${isForeign ? currency : "₹"}) incl GST`} required htmlFor="amount"
                className={cn(isGstBill ? "col-span-8 sm:col-span-5" : "col-span-8 sm:col-span-9")}>
                <Input id="amount" type="number" min={1} step="any" error={errors.amount?.message} {...register("amount")} />
              </FormField>
              {isGstBill && (
                <FormField label={`of which GST (${isForeign ? currency : "₹"})`} htmlFor="gst_paid" className="col-span-12 sm:col-span-4">
                  <Input id="gst_paid" type="number" min={0} step="any" {...register("gst_paid")} />
                </FormField>
              )}
            </div>

            {/* Foreign: exchange rate + ₹ preview */}
            {isForeign && (
              <div className="grid grid-cols-2 gap-3 items-end">
                <FormField label={`Exchange rate (₹ per 1 ${currency})`} required htmlFor="fx_rate">
                  <Input id="fx_rate" type="number" min={0} step="any" placeholder="e.g. 83.50"
                    value={fxRate} error={fxError ?? undefined}
                    onChange={(e) => { setFxRate(e.target.value); if (fxError) setFxError(null); }} />
                </FormField>
                {rate > 0 && Number(watch("amount")) > 0 && (
                  <p className="text-[12px] text-emerald pb-2">= ₹{Math.round(Number(watch("amount")) * rate).toLocaleString("en-IN")} in books{Number(watch("gst_paid")) > 0 ? ` · ₹${Math.round(Number(watch("gst_paid")) * rate).toLocaleString("en-IN")} GST` : ""}</p>
                )}
              </div>
            )}
            {isGstBill && !isForeign && (
              <p className="text-[10px] text-ink-3">GST is the input tax credit portion of the amount above — claimable in your GST return.</p>
            )}
            </div>
          </section>

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

          <DialogFooter>
            <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>{isEdit ? "Save changes" : "Save expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
