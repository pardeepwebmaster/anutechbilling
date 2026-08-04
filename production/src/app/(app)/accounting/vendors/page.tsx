/**
 * Vendors — supplier master (Google CSP, Microsoft, Zoho, etc.). Each vendor
 * rolls up its bills (total billed + outstanding), so the buy-side "kisko kitna
 * dena" reads at a glance. Bills still live on /accounting/bills; this is the
 * per-supplier view.
 */
"use client";

import * as React from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FAB } from "@/components/ui/fab";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useVendors, useUpsertVendor, useDeleteVendor, useBillsByVendor, type Vendor } from "@/lib/queries/vendors";
import { VENDOR_BILL_CATEGORIES } from "@/lib/queries/vendor-bills";
import { rupee, formatDate } from "@/lib/utils";

export default function VendorsPage() {
  const { data: vendors, isLoading } = useVendors();
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editVendor, setEditVendor] = React.useState<Vendor | null>(null);
  const [detailVendor, setDetailVendor] = React.useState<Vendor | null>(null);
  const del = useDeleteVendor();

  const rows = (vendors ?? []).filter((v) =>
    !search.trim() || v.name.toLowerCase().includes(search.toLowerCase()) || (v.gstin ?? "").toLowerCase().includes(search.toLowerCase()));
  const totalOutstanding = (vendors ?? []).reduce((s, v) => s + v.outstanding, 0);
  const totalBilled = (vendors ?? []).reduce((s, v) => s + v.totalBilled, 0);

  const confirmDelete = (v: Vendor) => {
    if (window.confirm(`Remove vendor "${v.name}"?\n\nIts ${v.billCount} bill(s) stay — they just lose the vendor link (name is kept).`)) {
      del.mutate(v.id);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Accounting</p>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Vendors</h1>
          <p className="text-sm text-ink-3 mt-1">
            Jinse aap kharidte ho (Google CSP · Microsoft · Zoho · etc.). Har vendor ke bills, kul kharcha aur dena baaki ek jagah.
          </p>
        </div>
        <Button variant="primary" icon="plus" className="hidden md:inline-flex" onClick={() => setAddOpen(true)}>Add vendor</Button>
      </div>

      {!isLoading && (vendors ?? []).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-5">
          <KPI label="Vendors" value={String((vendors ?? []).length)} />
          <KPI label="Total billed" value={rupee(totalBilled, { compact: true })} />
          <KPI label="Dena baaki" value={rupee(totalOutstanding, { compact: true })} tone={totalOutstanding > 0 ? "rose" : "emerald"} />
        </div>
      )}

      {(vendors ?? []).length > 0 && (
        <div className="mb-3 w-full sm:w-72">
          <Input prefix={<Icon name="search" size={14} />} placeholder="Vendor name / GSTIN…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (vendors ?? []).length === 0 ? (
        <Card className="py-2">
          <EmptyState
            icon="users"
            title="No vendors yet"
            body="Suppliers appear here automatically when you add a bill — or add one now."
            action={<Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add vendor</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-4 py-3">Vendor</th>
                  <th className="text-left  px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Bills</th>
                  <th className="text-right px-4 py-3">Total billed</th>
                  <th className="text-right px-4 py-3">Dena baaki</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-paper-2/40 cursor-pointer" onClick={() => setDetailVendor(v)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{v.name}</div>
                      {v.gstin && <div className="text-[11px] text-ink-3 font-mono">{v.gstin}</div>}
                    </td>
                    <td className="px-4 py-3">{v.default_category ? <Badge kind="muted" size="sm">{v.default_category}</Badge> : <span className="text-ink-3">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">{v.billCount || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.totalBilled > 0 ? rupee(v.totalBilled) : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {v.outstanding > 0
                        ? <span className="font-serif text-[15px] font-semibold text-rose">{rupee(v.outstanding)}</span>
                        : <span className="text-emerald">✓</span>}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <VendorActions onView={() => setDetailVendor(v)} onEdit={() => setEditVendor(v)} onDelete={() => confirmDelete(v)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-2.5">
            {rows.map((v) => (
              <li key={v.id}>
                <Card className="p-4" onClick={() => setDetailVendor(v)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{v.name}</div>
                      {v.gstin && <div className="text-[11px] text-ink-3 font-mono truncate">{v.gstin}</div>}
                      <div className="text-[11px] text-ink-3 mt-0.5">{v.billCount} bill{v.billCount === 1 ? "" : "s"} · {rupee(v.totalBilled, { compact: true })} billed</div>
                    </div>
                    <div className="text-right shrink-0">
                      {v.outstanding > 0
                        ? <span className="font-serif text-lg text-rose">{rupee(v.outstanding, { compact: true })}</span>
                        : <span className="text-emerald text-sm">✓ clear</span>}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <FAB icon="plus" label="Vendor" onClick={() => setAddOpen(true)} ariaLabel="Add vendor" />
      {addOpen && <VendorFormDialog onClose={() => setAddOpen(false)} />}
      {editVendor && <VendorFormDialog vendor={editVendor} onClose={() => setEditVendor(null)} />}
      {detailVendor && <VendorBillsDialog vendor={detailVendor} onClose={() => setDetailVendor(null)} onEdit={() => { setEditVendor(detailVendor); setDetailVendor(null); }} />}
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  const color = tone === "rose" ? "text-rose" : tone === "emerald" ? "text-emerald" : "text-ink";
  return (
    <Card className="p-3 md:p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">{label}</div>
      <div className={`font-serif text-xl md:text-2xl ${color} leading-tight`}>{value}</div>
    </Card>
  );
}

function VendorActions({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Actions" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-paper-2 hover:text-ink data-[state=open]:bg-paper-2">
          <Icon name="more_h" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer" onClick={onView}><Icon name="eye" size={15} /> View bills</DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer" onClick={onEdit}><Icon name="edit" size={15} /> Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive className="gap-2.5 py-2 cursor-pointer" onClick={onDelete}><Icon name="trash" size={15} /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VendorFormDialog({ vendor, onClose }: { vendor?: Vendor; onClose: () => void }) {
  const save = useUpsertVendor();
  const [name, setName] = React.useState(vendor?.name ?? "");
  const [gstin, setGstin] = React.useState(vendor?.gstin ?? "");
  const [category, setCategory] = React.useState(vendor?.default_category ?? "");
  const [contactName, setContactName] = React.useState(vendor?.contact_name ?? "");
  const [contactEmail, setContactEmail] = React.useState(vendor?.contact_email ?? "");
  const [contactPhone, setContactPhone] = React.useState(vendor?.contact_phone ?? "");
  const [notes, setNotes] = React.useState(vendor?.notes ?? "");

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await save.mutateAsync({
        id: vendor?.id, name: name.trim(), gstin: gstin || null, defaultCategory: category || null,
        contactName: contactName || null, contactEmail: contactEmail || null, contactPhone: contactPhone || null, notes: notes || null,
      });
      onClose();
    } catch { /* hook toasts */ }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription>Supplier ki details — bill add karte waqt ye apne-aap bhar jayengi.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Vendor name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Google Cloud India" autoFocus />
            </FormField>
            <FormField label="GSTIN (optional)">
              <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27ABCDE1234F1Z5" />
            </FormField>
          </div>
          <FormField label="Default category">
            <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {VENDOR_BILL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Contact name"><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></FormField>
            <FormField label="Email"><Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></FormField>
            <FormField label="Phone"><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></FormField>
          </div>
          <FormField label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reseller portal, account manager…" /></FormField>
        </div>
        <DialogFooter>
          <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VendorBillsDialog({ vendor, onClose, onEdit }: { vendor: Vendor; onClose: () => void; onEdit: () => void }) {
  const { data: bills, isLoading } = useBillsByVendor(vendor.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {vendor.name}
            {vendor.gstin && <span className="font-mono text-[11px] text-ink-3">{vendor.gstin}</span>}
          </DialogTitle>
          <DialogDescription>
            {vendor.billCount} bill{vendor.billCount === 1 ? "" : "s"} · {rupee(vendor.totalBilled)} billed ·{" "}
            <b className={vendor.outstanding > 0 ? "text-rose" : "text-emerald"}>{vendor.outstanding > 0 ? `${rupee(vendor.outstanding)} baaki` : "sab chukaya"}</b>
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (bills ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">No bills for this vendor yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {(bills ?? []).map((b) => {
                const out = Math.max(0, (b.total ?? 0) - (b.paid_amount ?? 0));
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{b.bill_no || b.id} <span className="text-ink-3">· {b.category}</span></p>
                      <p className="text-[11px] text-ink-3">{formatDate(b.bill_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-semibold text-ink">{rupee(b.total)}</p>
                      <p className={`text-[10px] ${out > 0 ? "text-rose" : "text-emerald"}`}>{out > 0 ? `${rupee(out)} due` : "paid"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button asChild variant="default"><Link href={"/accounting/bills" as never}>Open all bills</Link></Button>
          <Button variant="ghost" icon="edit" onClick={onEdit}>Edit vendor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
