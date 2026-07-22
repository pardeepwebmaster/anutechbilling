/**
 * Balance Sheet — statement of financial position.
 *
 * Assets = Liabilities + Equity, as of today. Auto figures come from ResellerOS
 * records (cash & bank, receivables, TDS receivable, payables, GST); the
 * operator adds manual lines for what the app doesn't track (fixed assets,
 * loans, owner's capital, drawings). Equity's "retained earnings" is derived so
 * the sheet always balances.
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { rupee, formatDate } from "@/lib/utils";
import {
  useBalanceSheetAuto,
  useBalanceSheetItems,
  useCreateBalanceSheetItem,
  useUpdateBalanceSheetItem,
  useDeleteBalanceSheetItem,
  type BalanceSheetItem,
} from "@/lib/queries/balance-sheet";
import type { BalanceSheetSection } from "@/lib/supabase/database.types";

export default function BalanceSheetPage() {
  const { data: auto, isLoading: autoLoading } = useBalanceSheetAuto();
  const { data: items, isLoading: itemsLoading } = useBalanceSheetItems();
  const del = useDeleteBalanceSheetItem();
  const [addOpen, setAddOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<BalanceSheetItem | null>(null);
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const loading = autoLoading || itemsLoading;

  const manual = (section: BalanceSheetSection) => (items ?? []).filter((i) => i.section === section);
  const sum = (rows: BalanceSheetItem[]) => rows.reduce((s, r) => s + r.amount, 0);

  // GST: positive → payable (liability); negative → ITC credit (asset).
  const gst = auto?.gstPayable ?? 0;
  const gstCredit = gst < 0 ? -gst : 0;
  const gstPayable = gst > 0 ? gst : 0;

  const autoAssets =
    (auto?.cashAndBank ?? 0) + (auto?.receivables ?? 0) + (auto?.tdsReceivable ?? 0)
    + (auto?.employeeLoans ?? 0) + (auto?.fixedAssets ?? 0) + gstCredit;
  const autoLiab = (auto?.payables ?? 0) + (auto?.salaryPayable ?? 0) + (auto?.salaryDuesPayable ?? 0) + (auto?.emiLoansPayable ?? 0) + gstPayable;

  const manualAssetRows = manual("asset");
  const manualLiabRows  = manual("liability");
  const manualEqRows    = manual("equity");

  const totalAssets = autoAssets + sum(manualAssetRows);
  const totalLiab   = autoLiab + sum(manualLiabRows);
  const netWorth    = totalAssets - totalLiab;                 // = total equity
  const retained    = netWorth - sum(manualEqRows);            // balancing plug

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Accounting</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Balance Sheet</h1>
          <p className="text-sm text-ink-3 mt-1">
            What you own vs what you owe · as of {formatDate(today)}
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
          Add line
        </Button>
      </div>

      {/* Honesty note */}
      <Card className="mb-6 bg-paper-2/40 p-3">
        <p className="text-[11px] text-ink-3 leading-relaxed flex items-start gap-1.5">
          <Icon name="info" size={13} className="mt-0.5 shrink-0" />
          <span>
            Auto figures (cash &amp; bank, receivables, TDS, payables, GST) come from your
            ResellerOS records. Add manual lines for anything the app doesn&apos;t track —
            fixed assets, loans, owner&apos;s capital, drawings — to make this a complete,
            CA-ready sheet. <b>Equity&apos;s retained earnings is derived so the sheet balances.</b>
          </span>
        </p>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-lg" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── ASSETS ── */}
            <Card className="p-5 md:p-6">
              <SectionTitle>Assets</SectionTitle>
              <div className="space-y-1 mt-3">
                <BSLine label="Cash & bank balances" amount={auto?.cashAndBank ?? 0} auto />
                <BSLine label="Trade receivables" hint="customers' unpaid balances" amount={auto?.receivables ?? 0} auto />
                <BSLine label="TDS receivable" hint="credits from customers' TDS" amount={auto?.tdsReceivable ?? 0} auto />
                {(auto?.employeeLoans ?? 0) > 0 && (
                  <BSLine label="Employee loans / advances" hint="outstanding, owed back" amount={auto?.employeeLoans ?? 0} auto />
                )}
                {(auto?.fixedAssets ?? 0) > 0 && (
                  <BSLine label="Fixed assets (EMI purchases)" hint="vehicles, equipment at cost" amount={auto?.fixedAssets ?? 0} auto />
                )}
                {gstCredit > 0 && <BSLine label="GST input credit (ITC)" amount={gstCredit} auto />}
                {manualAssetRows.map((r) => (
                  <BSLine key={r.id} label={r.label} amount={r.amount} onEdit={() => setEditItem(r)} onDelete={() => { if (window.confirm(`Remove "${r.label}" from the balance sheet?`)) del.mutate(r.id); }} />
                ))}
              </div>
              <TotalLine label="Total Assets" amount={totalAssets} />
            </Card>

            {/* ── LIABILITIES + EQUITY ── */}
            <Card className="p-5 md:p-6">
              <SectionTitle>Liabilities</SectionTitle>
              <div className="space-y-1 mt-3">
                <BSLine label="Trade payables" hint="unpaid vendor bills" amount={auto?.payables ?? 0} auto />
                {(auto?.salaryPayable ?? 0) > 0 && (
                  <BSLine label="Salary payable" hint="payroll run, not yet paid out" amount={auto?.salaryPayable ?? 0} auto />
                )}
                {(auto?.salaryDuesPayable ?? 0) > 0 && (
                  <BSLine label="Salary dues payable" hint="withheld TDS/PF/ESI, not yet remitted" amount={auto?.salaryDuesPayable ?? 0} auto />
                )}
                {(auto?.emiLoansPayable ?? 0) > 0 && (
                  <BSLine label="EMI / asset loans" hint="outstanding financing on purchases" amount={auto?.emiLoansPayable ?? 0} auto />
                )}
                {gstPayable > 0 && (
                  <BSLine label="GST payable" hint={`net, ${auto?.fyLabel ?? "this FY"} — before filing`} amount={gstPayable} auto />
                )}
                {manualLiabRows.map((r) => (
                  <BSLine key={r.id} label={r.label} amount={r.amount} onEdit={() => setEditItem(r)} onDelete={() => { if (window.confirm(`Remove "${r.label}" from the balance sheet?`)) del.mutate(r.id); }} />
                ))}
              </div>
              <TotalLine label="Total Liabilities" amount={totalLiab} muted />

              <div className="mt-6">
                <SectionTitle>Equity (net worth)</SectionTitle>
                <div className="space-y-1 mt-3">
                  {manualEqRows.map((r) => (
                    <BSLine key={r.id} label={r.label} amount={r.amount} onEdit={() => setEditItem(r)} onDelete={() => { if (window.confirm(`Remove "${r.label}" from the balance sheet?`)) del.mutate(r.id); }} />
                  ))}
                  <BSLine
                    label="Retained earnings"
                    hint="derived so the sheet balances"
                    amount={retained}
                  />
                </div>
                <TotalLine label="Total Equity" amount={netWorth} muted />
              </div>

              <div className="mt-4 border-t-2 border-ink pt-3">
                <TotalLine label="Total Liabilities + Equity" amount={totalLiab + netWorth} />
              </div>
            </Card>
          </div>

          {/* Balance check — always balanced by construction */}
          <Card className="mt-6 p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Icon name="check_circle" size={18} className="text-emerald" />
              <span className="text-sm text-ink-2">
                Balanced: <b>Assets {rupee(totalAssets)}</b> = <b>Liabilities + Equity {rupee(totalLiab + netWorth)}</b>
              </span>
            </div>
            <span className={`font-serif text-2xl ${netWorth >= 0 ? "text-emerald" : "text-rose"}`}>
              Net worth {rupee(netWorth)}
            </span>
          </Card>
        </>
      )}

      <AddLineDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {editItem && <EditLineDialog item={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}

// ── Line + total primitives ─────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold border-b border-hairline pb-2">
      {children}
    </h2>
  );
}

function BSLine({
  label, hint, amount, auto, onEdit, onDelete,
}: {
  label: string; hint?: string; amount: number; auto?: boolean; onEdit?: () => void; onDelete?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 group">
      <div className="min-w-0 flex items-center gap-1.5">
        <span className="text-sm text-ink truncate">{label}</span>
        {auto && <Badge kind="muted" size="sm">auto</Badge>}
        {hint && <span className="text-[11px] text-ink-3 hidden sm:inline">· {hint}</span>}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-ink transition-opacity"
            aria-label={`Edit ${label}`}
          >
            <Icon name="edit" size={12} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-rose transition-opacity"
            aria-label={`Remove ${label}`}
          >
            <Icon name="trash" size={12} />
          </button>
        )}
      </div>
      <span className={`font-mono text-sm tabular-nums whitespace-nowrap ${amount < 0 ? "text-rose" : "text-ink"}`}>
        {amount < 0 ? "−" : ""}{rupee(Math.abs(amount))}
      </span>
    </div>
  );
}

function TotalLine({ label, amount, muted }: { label: string; amount: number; muted?: boolean }) {
  return (
    <div className={`mt-3 pt-2 border-t ${muted ? "border-hairline" : "border-ink-2 border-t-2"} flex items-baseline justify-between gap-3`}>
      <span className={`${muted ? "text-sm text-ink-2" : "text-sm font-semibold text-ink"}`}>{label}</span>
      <span className={`font-mono tabular-nums whitespace-nowrap ${muted ? "text-base text-ink" : "font-serif text-xl text-ink"} ${amount < 0 ? "!text-rose" : ""}`}>
        {amount < 0 ? "−" : ""}{rupee(Math.abs(amount))}
      </span>
    </div>
  );
}

// ── Add manual line dialog ────────────────────────────────────────────────
const SECTIONS: { value: BalanceSheetSection; label: string; examples: string }[] = [
  { value: "asset",     label: "Asset",     examples: "Fixed assets, deposits, investments" },
  { value: "liability", label: "Liability", examples: "Bank loan, unsecured loan, other dues" },
  { value: "equity",    label: "Equity",    examples: "Owner's capital, drawings (as negative)" },
];

const schema = z.object({
  label:  z.string().min(2, "Name required"),
  amount: z.coerce.number().int(),
  notes:  z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function EditLineDialog({ item, onClose }: { item: BalanceSheetItem; onClose: () => void }) {
  const update = useUpdateBalanceSheetItem();
  const [label, setLabel] = React.useState(item.label);
  const [amount, setAmount] = React.useState(String(item.amount));

  async function submit() {
    const amt = Math.round(Number(amount));
    if (!label.trim() || !Number.isFinite(amt)) return;
    await update.mutateAsync({ id: item.id, label: label.trim(), amount: amt });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>Edit line</DialogTitle>
          <DialogDescription>Update this manual balance-sheet line — e.g. reduce a loan balance after an EMI.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Amount (₹)</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="mt-1 text-[11px] text-ink-3">Negative allowed (e.g. depreciation, drawings).</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button variant="primary" loading={update.isPending} disabled={!label.trim()} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLineDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateBalanceSheetItem();
  const [section, setSection] = React.useState<BalanceSheetSection>("asset");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0 },
  });

  React.useEffect(() => { if (!open) { reset(); setSection("asset"); } }, [open, reset]);

  const onSubmit = async (data: FormData) => {
    await create.mutateAsync({ section, label: data.label.trim(), amount: data.amount, notes: data.notes?.trim() || null });
    onClose();
  };

  const sectionMeta = SECTIONS.find((s) => s.value === section);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>Add balance-sheet line</DialogTitle>
          <DialogDescription>
            Add something the app doesn&apos;t track automatically — a fixed asset, a loan,
            owner&apos;s capital, etc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Section" required htmlFor="bs-section">
            <Select value={section} onValueChange={(v) => setSection(v as BalanceSheetSection)}>
              <SelectTrigger id="bs-section"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {sectionMeta && <p className="text-[10px] text-ink-3 mt-1">e.g. {sectionMeta.examples}</p>}
          </FormField>

          <FormField label="Name" required htmlFor="bs-label">
            <Input id="bs-label" placeholder="e.g. Office laptop, HDFC term loan, Owner's capital" error={errors.label?.message} {...register("label")} />
          </FormField>

          <FormField label="Amount (₹)" required htmlFor="bs-amount">
            <Input id="bs-amount" type="number" prefix="₹" error={errors.amount?.message} {...register("amount")} />
            <p className="text-[10px] text-ink-3 mt-1">
              Use a negative value for contra items — accumulated depreciation, or owner&apos;s drawings.
            </p>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting || create.isPending}>Add line</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
