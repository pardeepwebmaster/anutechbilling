/**
 * AddVendorBillDialog — capture a bill received from a supplier.
 *
 * Auto-fills:
 *   - subtotal = total − (cgst+sgst+igst)  (if user enters total+gst)
 *   - status = unpaid (default)
 *
 * Intra-state GST: enter CGST + SGST (each 9% for SaaS HSN 998313).
 * Inter-state GST: enter IGST (18% combined).
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCreateVendorBill, uploadBillAttachment, VENDOR_BILL_CATEGORIES } from "@/lib/queries/vendor-bills";
import { useVendors, ensureVendor } from "@/lib/queries/vendors";

const schema = z.object({
  vendor_name:  z.string().min(2, "Vendor name required"),
  vendor_gstin: z.string().optional(),
  bill_no:      z.string().optional(),
  bill_date:    z.string().min(10, "Bill date required"),
  due_date:     z.string().optional(),
  category:     z.string().min(2),
  subtotal:     z.coerce.number().min(0),
  cgst:         z.coerce.number().min(0).default(0),
  sgst:         z.coerce.number().min(0).default(0),
  igst:         z.coerce.number().min(0).default(0),
  total:        z.coerce.number().min(1, "Total must be > 0"),
  notes:        z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const VENDOR_PRESETS = [
  { name: "Google Cloud / Workspace", gstin: "", category: "COGS-Workspace" },
  { name: "Microsoft Partner Center", gstin: "", category: "COGS-M365" },
  { name: "Zoho Corporation",         gstin: "", category: "COGS-Zoho" },
];

export function AddVendorBillDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateVendorBill();
  const today  = new Date().toISOString().slice(0, 10);

  // Vendor master autocomplete — pick an existing supplier (fills GSTIN +
  // category) or type a new name (auto-added to Vendors on save).
  const { data: vendors } = useVendors();
  const [vendorId, setVendorId] = React.useState<string | null>(null);
  const [vendorOpen, setVendorOpen] = React.useState(false);

  // ── AI bill reader ────────────────────────────────────────────────────────
  // Upload a photo/PDF → Gemini extracts the fields → we PRE-FILL the form. The
  // values stay editable and are never auto-saved — the operator verifies the
  // amounts against the bill (they feed GST input credit + P&L).
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [aiNote, setAiNote]   = React.useState<string | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  // The uploaded file is kept and attached to the bill on save (proof).
  const [attachFile, setAttachFile] = React.useState<File | null>(null);

  async function handleBillFile(file: File) {
    setAiError(null); setAiNote(null);
    if (file.size > 8 * 1024 * 1024) { setAiError("File is too big (max 8 MB) — try a smaller photo."); return; }
    setAttachFile(file);   // keep it — attaches to the bill on save
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
      const f = json.fields as Record<string, string | number | null>;
      // Prefill — only overwrite what the AI actually found.
      if (f.vendor_name)  setValue("vendor_name",  String(f.vendor_name));
      if (f.vendor_gstin) setValue("vendor_gstin", String(f.vendor_gstin));
      if (f.bill_no)      setValue("bill_no",      String(f.bill_no));
      if (f.bill_date)    setValue("bill_date",    String(f.bill_date));
      if (f.subtotal != null) setValue("subtotal", Number(f.subtotal));
      setValue("cgst", Number(f.cgst ?? 0));
      setValue("sgst", Number(f.sgst ?? 0));
      setValue("igst", Number(f.igst ?? 0));
      if (f.total != null) setValue("total", Number(f.total));
      if (f.category_guess && (VENDOR_BILL_CATEGORIES as readonly string[]).includes(String(f.category_guess))) {
        setValue("category", String(f.category_guess));
      }
      setAiNote(`AI ne bhar diya · 📎 "${file.name}" bill ke saath attach ho jayega — amounts bill se milaa ke Save karo.`);
    } catch {
      setAiError("Upload failed — try again, ya fields haath se bhar do.");
    } finally {
      setReading(false);
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      bill_date: today,
      category:  "COGS-Workspace",
      subtotal:  0, cgst: 0, sgst: 0, igst: 0, total: 0,
    },
  });

  const subtotal = Number(watch("subtotal") || 0);
  const cgst     = Number(watch("cgst")     || 0);
  const sgst     = Number(watch("sgst")     || 0);
  const igst     = Number(watch("igst")     || 0);
  const computedTotal = subtotal + cgst + sgst + igst;

  // Quick-fill: pretend the user typed only subtotal — auto-derive intra/inter
  function applyGST18Intra() {
    const half = Math.round(subtotal * 0.09);
    setValue("cgst", half);
    setValue("sgst", half);
    setValue("igst", 0);
    setValue("total", subtotal + half * 2);
  }
  function applyGST18Inter() {
    const igstAmt = Math.round(subtotal * 0.18);
    setValue("cgst", 0);
    setValue("sgst", 0);
    setValue("igst", igstAmt);
    setValue("total", subtotal + igstAmt);
  }
  function syncTotalToComputed() {
    setValue("total", computedTotal);
  }

  async function onSubmit(values: FormData) {
    // Link to the vendors master — reuse the picked vendor, else find-or-create
    // one from the typed name (keeps the master clean + dedup'd).
    const vId = vendorId ?? await ensureVendor({
      name: values.vendor_name, gstin: values.vendor_gstin, defaultCategory: values.category,
    });
    // Attach the uploaded bill file (proof) — non-fatal if the upload fails.
    let attachment_url: string | null = null;
    if (attachFile) {
      try { attachment_url = await uploadBillAttachment(attachFile); }
      catch { /* keep saving the bill even if the file upload hiccups */ }
    }
    await create.mutateAsync({
      vendor_id:    vId,
      attachment_url,
      vendor_name:  values.vendor_name,
      vendor_gstin: values.vendor_gstin || null,
      bill_no:      values.bill_no      || null,
      bill_date:    values.bill_date,
      due_date:     values.due_date     || null,
      category:     values.category,
      subtotal:     Math.round(values.subtotal),
      cgst:         Math.round(values.cgst),
      sgst:         Math.round(values.sgst),
      igst:         Math.round(values.igst),
      total:        Math.round(values.total),
      notes:        values.notes        || null,
      status:       "unpaid",
      line_items:   [],
    });
    onClose();
  }

  function applyVendorPreset(idx: number) {
    const p = VENDOR_PRESETS[idx];
    if (!p) return;
    setValue("vendor_name", p.name);
    setValue("category",    p.category);
    setVendorId(null);   // find-or-create on save
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Vendor Bill</DialogTitle>
          <DialogDescription>
            Record a bill received from a supplier — Google CSP, Microsoft Partner, Zoho Partner, etc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* AI bill reader — upload → auto-fill (review before saving). */}
          <div className="rounded-lg border border-dashed border-amber/50 bg-amber-soft/20 p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="sparkles" size={18} className="text-amber-ink shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Bill upload karo — AI khud bhar dega</p>
                  <p className="text-[11px] text-ink-3">Photo (JPG/PNG) ya PDF · fields nikaal ke form bhar dega, aap check karke Save karo</p>
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
            {aiNote && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald">
                <Icon name="check_circle" size={12} /> {aiNote}
              </p>
            )}
            {aiError && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose">
                <Icon name="alert" size={12} /> {aiError}
              </p>
            )}
            {attachFile && !aiNote && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-2">
                <Icon name="file" size={12} /> {attachFile.name} — bill ke saath attach hoga
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold self-center mr-1">
              Quick fill:
            </span>
            {VENDOR_PRESETS.map((p, i) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyVendorPreset(i)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-hairline text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
              >
                {p.name.split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Vendor name" required htmlFor="vendor_name">
              <div className="relative">
                <Input
                  id="vendor_name"
                  placeholder="Google Cloud"
                  autoComplete="off"
                  error={errors.vendor_name?.message}
                  {...register("vendor_name", { onChange: () => { setVendorId(null); setVendorOpen(true); } })}
                  onFocus={() => setVendorOpen(true)}
                  onBlur={() => setTimeout(() => setVendorOpen(false), 130)}
                />
                {vendorOpen && (vendors ?? []).length > 0 && (() => {
                  const q = (watch("vendor_name") || "").trim().toLowerCase();
                  const matches = (vendors ?? []).filter((v) => !q || v.name.toLowerCase().includes(q)).slice(0, 8);
                  if (matches.length === 0) return null;
                  return (
                    <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-hairline bg-paper shadow-lg">
                      {matches.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setValue("vendor_name", v.name);
                            if (v.gstin) setValue("vendor_gstin", v.gstin);
                            if (v.default_category && (VENDOR_BILL_CATEGORIES as readonly string[]).includes(v.default_category)) {
                              setValue("category", v.default_category);
                            }
                            setVendorId(v.id);
                            setVendorOpen(false);
                          }}
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
            </FormField>
            <FormField label="Vendor GSTIN (optional)" htmlFor="vendor_gstin">
              <Input id="vendor_gstin" placeholder="27ABCDE1234F1Z5" {...register("vendor_gstin")} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Bill # (vendor's)" htmlFor="bill_no">
              <Input id="bill_no" placeholder="INV-12345" {...register("bill_no")} />
            </FormField>
            <FormField label="Bill date" required htmlFor="bill_date">
              <Input id="bill_date" type="date" error={errors.bill_date?.message} {...register("bill_date")} />
            </FormField>
            <FormField label="Due date (optional)" htmlFor="due_date">
              <Input id="due_date" type="date" {...register("due_date")} />
            </FormField>
          </div>

          <FormField label="Category" required htmlFor="category">
            <Select
              value={watch("category")}
              onValueChange={(v) => setValue("category", v)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_BILL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-ink-3 mt-1">
              Categories starting with <code>COGS-</code> count as cost of goods sold in the P&L.
            </p>
          </FormField>

          {/* Amounts grid */}
          <div className="p-3 rounded-lg border border-hairline bg-paper-2/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <FormField label="Pre-GST subtotal (₹)" required htmlFor="subtotal">
                <Input id="subtotal" type="number" min={0} step={1} error={errors.subtotal?.message} {...register("subtotal")} />
              </FormField>
              <FormField label="CGST (₹)" htmlFor="cgst">
                <Input id="cgst" type="number" min={0} step={1} {...register("cgst")} />
              </FormField>
              <FormField label="SGST (₹)" htmlFor="sgst">
                <Input id="sgst" type="number" min={0} step={1} {...register("sgst")} />
              </FormField>
              <FormField label="IGST (₹)" htmlFor="igst">
                <Input id="igst" type="number" min={0} step={1} {...register("igst")} />
              </FormField>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button type="button" onClick={applyGST18Intra}
                className="text-[11px] px-2.5 py-1 rounded-full border border-hairline text-ink-3 hover:text-ink hover:bg-paper transition-colors">
                Intra-state GST 18% (CGST 9 + SGST 9)
              </button>
              <button type="button" onClick={applyGST18Inter}
                className="text-[11px] px-2.5 py-1 rounded-full border border-hairline text-ink-3 hover:text-ink hover:bg-paper transition-colors">
                Inter-state GST 18% (IGST 18)
              </button>
            </div>
          </div>

          <FormField label="Total (₹) incl GST" required htmlFor="total">
            <div className="flex items-center gap-2">
              <Input id="total" type="number" min={1} step={1} error={errors.total?.message} {...register("total")} />
              {computedTotal > 0 && Number(watch("total")) !== computedTotal && (
                <Button type="button" variant="ghost" size="sm" onClick={syncTotalToComputed}>
                  = ₹{computedTotal.toLocaleString("en-IN")}
                </Button>
              )}
            </div>
          </FormField>

          <FormField label="Notes (optional)" htmlFor="notes">
            <Textarea id="notes" rows={2} placeholder="Reference, period, comments…" {...register("notes")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              Save bill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
