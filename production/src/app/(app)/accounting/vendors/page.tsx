/**
 * Vendors — supplier master (Google CSP, Microsoft, Zoho, etc.). Each vendor
 * rolls up its bills (total billed + outstanding), so the buy-side "kisko kitna
 * dena" reads at a glance. Bills still live on /accounting/bills; this is the
 * per-supplier view.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { StatStrip } from "@/components/shared/stat-strip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useConfirm } from "@/components/providers/confirm-provider";
import { useVendors, useUpsertVendor, useDeleteVendor, useBillsByVendor, type Vendor } from "@/lib/queries/vendors";
import { VENDOR_BILL_CATEGORIES } from "@/lib/queries/vendor-bills";
import { rupee, formatDate, GST_STATE_BY_CODE } from "@/lib/utils";

export default function VendorsPage() {
  const router = useRouter();
  const { data: vendors, isLoading } = useVendors();
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editVendor, setEditVendor] = React.useState<Vendor | null>(null);
  const [detailVendor, setDetailVendor] = React.useState<Vendor | null>(null);
  const del = useDeleteVendor();
  const confirm = useConfirm();

  const rows = (vendors ?? []).filter((v) =>
    !search.trim() || v.name.toLowerCase().includes(search.toLowerCase()) || (v.gstin ?? "").toLowerCase().includes(search.toLowerCase()));
  const totalOutstanding = (vendors ?? []).reduce((s, v) => s + v.outstanding, 0);
  const totalBilled = (vendors ?? []).reduce((s, v) => s + v.totalBilled, 0);

  const confirmDelete = async (v: Vendor) => {
    if (await confirm({
      title: `Remove vendor "${v.name}"?`,
      body: `Its ${v.billCount} bill(s) stay — they just lose the vendor link (name is kept).`,
      confirmLabel: "Remove",
      danger: true,
    })) {
      del.mutate(v.id);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Purchases</p>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Vendors</h1>
          <p className="text-sm text-ink-3 mt-1">
            Who you buy from (Google CSP · Microsoft · Zoho · etc.). Every vendor&apos;s bills, total spend, and outstanding balance in one place.
          </p>
        </div>
        <Button variant="primary" icon="plus" className="hidden md:inline-flex" onClick={() => setAddOpen(true)}>Add vendor</Button>
      </div>

      {!isLoading && (vendors ?? []).length > 0 && (
        <StatStrip
          className="mb-5"
          items={[
            { label: "Vendors",      value: (vendors ?? []).length },
            { label: "Total billed", value: rupee(totalBilled, { compact: true }) },
            { label: "Outstanding",  value: rupee(totalOutstanding, { compact: true }), tone: totalOutstanding > 0 ? "rose" : "emerald" },
          ]}
        />
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
          <Card flush className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-2 border-b border-hairline-strong text-[11px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-4 py-2.5">Vendor</th>
                  <th className="text-left  px-4 py-2.5">Category</th>
                  <th className="text-right px-4 py-2.5">Bills</th>
                  <th className="text-right px-4 py-2.5">Total billed</th>
                  <th className="text-right px-4 py-2.5">Outstanding</th>
                  <th className="text-right px-2 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((v) => (
                  <tr
                    key={v.id}
                    className="group hover:bg-paper-2/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-inset"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${v.name}`}
                    onClick={() => setDetailVendor(v)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailVendor(v); } }}
                  >
                    <td className="px-4 py-2.5 align-top">
                      <div className="font-medium text-ink leading-snug">{v.name}</div>
                      {v.gstin && <div className="text-[11px] text-ink-3 font-mono">{v.gstin}</div>}
                      {v.contact_email && <div className="text-[11px] text-ink-3 truncate">{v.contact_email}</div>}
                    </td>
                    <td className="px-4 py-2.5 align-top">{v.default_category ? <Badge kind="muted" size="sm">{v.default_category}</Badge> : <span className="text-ink-3">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2 align-top">{v.billCount || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums align-top">{v.totalBilled > 0 ? rupee(v.totalBilled) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums align-top">
                      {v.outstanding > 0
                        ? <span className="font-serif text-[15px] font-semibold text-rose">{rupee(v.outstanding)}</span>
                        : <span className="text-emerald">✓</span>}
                    </td>
                    <td className="px-2 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <VendorActions
                          onView={() => setDetailVendor(v)}
                          onEdit={() => setEditVendor(v)}
                          onDelete={() => confirmDelete(v)}
                          onUploadBill={() => router.push("/accounting/bills" as never)}
                          onRecordPayment={() => router.push("/accounting/bills" as never)}
                        />
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

function VendorActions({ onView, onEdit, onDelete, onUploadBill, onRecordPayment }: {
  onView: () => void; onEdit: () => void; onDelete: () => void;
  onUploadBill: () => void; onRecordPayment: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Vendor actions" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-paper-2 hover:text-ink data-[state=open]:bg-paper-2">
          <Icon name="more_h" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer" onClick={onUploadBill}><Icon name="upload" size={15} /> Upload bill</DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer" onClick={onRecordPayment}><Icon name="rupee" size={15} /> Record payment</DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer" onClick={onView}><Icon name="eye" size={15} /> View ledger</DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer" onClick={onEdit}><Icon name="edit" size={15} /> Edit vendor details</DropdownMenuItem>
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
  const [address, setAddress] = React.useState(vendor?.address ?? "");
  const [city, setCity] = React.useState(vendor?.city ?? "");
  const [state, setState] = React.useState(vendor?.state ?? "");
  const [pincode, setPincode] = React.useState(vendor?.pincode ?? "");
  const [notes, setNotes] = React.useState(vendor?.notes ?? "");

  const STATE_NAMES = React.useMemo(() => Object.values(GST_STATE_BY_CODE).sort(), []);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await save.mutateAsync({
        id: vendor?.id, name: name.trim(), gstin: gstin || null, defaultCategory: category || null,
        contactName: contactName || null, contactEmail: contactEmail || null, contactPhone: contactPhone || null,
        address: address || null, city: city || null, state: state || null, pincode: pincode || null,
        notes: notes || null,
      });
      onClose();
    } catch { /* hook toasts */ }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription>Supplier details — these auto-fill when you add a bill.</DialogDescription>
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
          <FormField label="Address (optional)">
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, street, area…" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" />
            </FormField>
            <FormField label="State (place of supply)">
              <Select value={state || "none"} onValueChange={(v) => setState(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none —</SelectItem>
                  {STATE_NAMES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="PIN code">
              <Input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="400001" />
            </FormField>
          </div>
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
            <b className={vendor.outstanding > 0 ? "text-rose" : "text-emerald"}>{vendor.outstanding > 0 ? `${rupee(vendor.outstanding)} due` : "all paid"}</b>
            {[vendor.address, vendor.city, vendor.state, vendor.pincode].some(Boolean) && (
              <span className="mt-1 block text-[12px] not-italic text-ink-3">
                📍 {[vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(", ")}
              </span>
            )}
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
