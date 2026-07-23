/**
 * CreateProjectQuoteDialog — build an itemised project quotation to send a
 * customer. Line items are picked from the one-time Items Catalog (or typed
 * custom); taxable = Σ line amounts, GST + total computed live. On save it
 * creates a project in 'quoted' status; the customer accepts via the public
 * link, which flips it to an active project.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useItems } from "@/lib/queries/items";
import { useCustomers, useCreateCustomer } from "@/lib/queries/customers";
import { useCreateProjectQuote, type MilestoneInput, type ProjectQuoteLine } from "@/lib/queries/projects";
import { rupee } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LineRow = { name: string; qty: string; rate: string };
type MsRow   = { label: string; amount: string; due: string };

export function CreateProjectQuoteDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const create = useCreateProjectQuote();
  const createCustomer = useCreateCustomer();
  const { data: allItems } = useItems();
  const { data: customers } = useCustomers();
  const oneTimeItems = React.useMemo(
    () => (allItems ?? []).filter((i) => i.item_type === "one_time" && i.is_active),
    [allItems],
  );

  // Customer: pick an existing one, or create a new one inline (""=new).
  const [customerId, setCustomerId]   = React.useState("");
  const [newName, setNewName]         = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail]             = React.useState("");
  const [phone, setPhone]             = React.useState("");
  const [gstin, setGstin]             = React.useState("");
  const [stateName, setStateName]     = React.useState("");
  const [title, setTitle]             = React.useState("");
  const [description, setDescription]   = React.useState("");
  const [gstRate, setGstRate]           = React.useState("18");
  const [interState, setInterState]     = React.useState(false);
  const [lines, setLines]               = React.useState<LineRow[]>([{ name: "", qty: "1", rate: "" }]);
  const [rows, setRows]                 = React.useState<MsRow[]>([{ label: "Advance", amount: "", due: "" }]);

  React.useEffect(() => {
    if (!open) {
      setCustomerId(""); setNewName(""); setContactName(""); setEmail(""); setPhone(""); setGstin(""); setStateName("");
      setTitle(""); setDescription(""); setGstRate("18"); setInterState(false);
      setLines([{ name: "", qty: "1", rate: "" }]); setRows([{ label: "Advance", amount: "", due: "" }]);
    }
  }, [open]);

  const isNewCustomer = customerId === "";
  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const effectiveName = isNewCustomer ? newName.trim() : (selectedCustomer?.name ?? "");

  const lineAmount = (l: LineRow) => Math.max(0, Math.round(Number(l.qty) || 0)) * Math.max(0, Math.round(Number(l.rate) || 0));
  const taxableNum = lines.reduce((s, l) => s + lineAmount(l), 0);
  const rateNum    = Math.max(0, Math.round(Number(gstRate) || 0));
  const gstNum     = Math.round(taxableNum * rateNum / 100);
  const totalNum   = taxableNum + gstNum;
  const milestonesTotal = rows.reduce((s, r) => s + Math.max(0, Math.round(Number(r.amount) || 0)), 0);
  const mismatch = milestonesTotal !== totalNum;

  const setLine = (i: number, patch: Partial<LineRow>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { name: "", qty: "1", rate: "" }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const pickItem = (i: number, itemId: string) => {
    const it = oneTimeItems.find((x) => x.id === itemId);
    if (it) setLine(i, { name: it.name, rate: String(it.msrp) });
  };

  const setRow = (i: number, patch: Partial<MsRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { label: `Milestone ${rs.length + 1}`, amount: "", due: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const canSubmit =
    effectiveName.length >= 2 && title.trim().length >= 2 &&
    lines.some((l) => l.name.trim() && lineAmount(l) > 0) &&
    rows.some((r) => Math.round(Number(r.amount) || 0) > 0) &&
    !create.isPending && !createCustomer.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const lineItems: ProjectQuoteLine[] = lines
      .filter((l) => l.name.trim() && lineAmount(l) > 0)
      .map((l) => ({
        name:   l.name.trim(),
        qty:    Math.max(1, Math.round(Number(l.qty) || 1)),
        rate:   Math.max(0, Math.round(Number(l.rate) || 0)),
        amount: lineAmount(l),
      }));
    const milestones: MilestoneInput[] = rows
      .filter((r) => Math.round(Number(r.amount) || 0) > 0)
      .map((r) => ({ label: r.label.trim() || "Milestone", total_amount: Math.round(Number(r.amount) || 0), due_date: r.due || null }));
    try {
      // New customer? create it first so the quote (and its invoices) link to a
      // complete customer record — not just a bare name.
      let cid: string | null = customerId || null;
      let cname = effectiveName;
      if (isNewCustomer) {
        const cust = await createCustomer.mutateAsync({
          name:          newName.trim(),
          contact_name:  contactName.trim() || null,
          contact_email: email.trim() || null,
          contact_phone: phone.trim() || null,
          gstin:         gstin.trim() || null,
          state:         stateName.trim() || null,
        });
        cid = cust.id; cname = cust.name;
      }
      const id = await create.mutateAsync({
        customerId: cid, customerName: cname, title: title.trim(),
        description: description.trim() || null, lineItems, gstRate: rateNum, interState, milestones,
      });
      onOpenChange(false);
      router.push(`/projects/${id}` as Route);
    } catch { /* hook toasts */ }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 flex flex-col overflow-x-hidden">
        <SheetHeader>
          <SheetTitle>New project quotation</SheetTitle>
          <SheetDescription>
            Itemised quote for a one-time project. Send the customer the link — when they accept, it becomes an active project.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <FormField label="Customer" required htmlFor="q_customer">
            <select
              id="q_customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
            >
              <option value="">➕ New customer…</option>
              {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>

          {isNewCustomer && (
            <div className="rounded-md border border-hairline bg-paper-2/30 p-3 space-y-2">
              <p className="text-[11px] text-ink-3 font-semibold uppercase tracking-wider">New customer details</p>
              <Input placeholder="Company name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Contact person" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="GSTIN" className="font-mono" value={gstin} onChange={(e) => setGstin(e.target.value)} />
                <Input placeholder="State (e.g. Maharashtra)" value={stateName} onChange={(e) => setStateName(e.target.value)} />
              </div>
              <p className="text-[10px] text-ink-3">GSTIN + state make the tax invoice GST-correct (CGST/SGST vs IGST + the customer&apos;s ITC).</p>
            </div>
          )}

          <FormField label="Project title" required htmlFor="q_title">
            <Input id="q_title" placeholder="Custom accounting software" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Description" htmlFor="q_desc">
            <textarea id="q_desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope / notes (optional)"
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-amber resize-y" />
          </FormField>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-2">Line items (taxable ₹)</p>
              <button type="button" onClick={addLine} className="text-[11px] text-amber-ink hover:underline inline-flex items-center gap-0.5">
                <Icon name="plus" size={12} /> Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="space-y-1.5 rounded-md border border-hairline p-2">
                  <div className="flex items-center gap-2">
                    {oneTimeItems.length > 0 && (
                      <select
                        value="" onChange={(e) => pickItem(i, e.target.value)}
                        className="w-28 shrink-0 rounded-md border border-hairline bg-paper px-2 py-2 text-xs text-ink-2 focus:outline-none focus:ring-2 focus:ring-amber/40"
                        title="Quick-fill from catalog"
                      >
                        <option value="">Catalog…</option>
                        {oneTimeItems.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                      </select>
                    )}
                    <Input className="flex-1" placeholder="Item / service" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                    <button type="button" aria-label="Remove" onClick={() => removeLine(i)} className="text-ink-3 hover:text-rose"><Icon name="x" size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-ink-3">Qty</label>
                    <Input className="w-16" inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                    <label className="text-[11px] text-ink-3">Rate</label>
                    <Input className="w-28" inputMode="numeric" prefix="₹" placeholder="0" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} />
                    <span className="ml-auto text-sm font-mono text-ink">{rupee(lineAmount(l))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="GST rate %" htmlFor="q_gst">
              <Input id="q_gst" inputMode="numeric" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-ink-2 mt-6">
              <input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)} className="rounded border-hairline" />
              Inter-state (IGST)
            </label>
          </div>

          {/* Totals */}
          <div className="rounded-md border border-hairline bg-paper-2/40 p-3 text-sm space-y-1">
            <Line label="Taxable value" value={rupee(taxableNum)} />
            <Line label={`GST @ ${rateNum}%`} value={rupee(gstNum)} />
            <div className="border-t border-hairline pt-1 mt-1"><Line label="Total" value={rupee(totalNum)} strong /></div>
          </div>

          {/* Milestones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-2">Payment schedule (GST-inclusive)</p>
              <button type="button" onClick={addRow} className="text-[11px] text-amber-ink hover:underline inline-flex items-center gap-0.5">
                <Icon name="plus" size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input className="flex-1" placeholder="Label" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                  <Input className="w-28" inputMode="numeric" prefix="₹" placeholder="0" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
                  <Input className="w-36" type="date" value={r.due} onChange={(e) => setRow(i, { due: e.target.value })} />
                  <button type="button" aria-label="Remove" onClick={() => removeRow(i)} className="mt-2 text-ink-3 hover:text-rose"><Icon name="x" size={16} /></button>
                </div>
              ))}
            </div>
            <div className={`mt-2 text-[11px] ${mismatch ? "text-rose" : "text-emerald"}`}>
              Schedule total {rupee(milestonesTotal)} · {mismatch ? `should equal ${rupee(totalNum)}` : "matches total ✓"}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="primary" loading={create.isPending} disabled={!canSubmit} onClick={handleSubmit}>
            Create quotation
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? "text-ink font-semibold" : "text-ink-3"}>{label}</span>
      <span className={`font-mono ${strong ? "text-ink font-semibold" : "text-ink-2"}`}>{value}</span>
    </div>
  );
}
