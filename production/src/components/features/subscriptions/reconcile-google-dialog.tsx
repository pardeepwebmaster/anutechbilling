/**
 * ReconcileGoogleDialog — compare the app's subscriptions against the Google
 * Workspace reseller-panel export (Partner Sales Console → "Download customers").
 *
 * The Google panel is the source of truth for what's actually provisioned/billed.
 * Match key = the **service domain** (Google "Customer" column ↔ app subscription.domain).
 *
 * READ-ONLY: this is a diagnostic report. It never writes to the DB — it shows the
 * gap (and lets you download each bucket as CSV). Bulk-add of the missing subs is a
 * deliberate next step, after you've reviewed the report.
 *
 * MONEY-HONESTY: the Google export carries NO price. "Only in Google" MRR is an
 * ESTIMATE from the catalog (msrp × seats), clearly labelled — never confirmed.
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { useSubscriptions } from "@/lib/queries/subscriptions";
import { useItems } from "@/lib/queries/items";
import { rupee, cn } from "@/lib/utils";

type Bucket = "only_google" | "matched" | "only_app" | "suspended";

interface Row {
  domain: string;
  sku: string;
  seats: number;
  status: string;   // Active / Suspended / …
  renewal: string;
  estMrr?: number;  // only_google
  appSeats?: number; // matched (for diff)
}

interface Report {
  googleActive: number;
  googleSuspended: number;
  appCount: number;
  estMissingMrr: number;        // monthly, active only_google
  buckets: Record<Bucket, Row[]>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const BUCKET_META: { id: Bucket; label: string; tone: "danger" | "success" | "warning" | "muted" }[] = [
  { id: "only_google", label: "Only in Google", tone: "danger" },
  { id: "matched",     label: "Matched",        tone: "success" },
  { id: "suspended",   label: "Suspended (billing risk)", tone: "warning" },
  { id: "only_app",    label: "Only in app",    tone: "muted" },
];

export function ReconcileGoogleDialog({ open, onOpenChange }: Props) {
  const { data: subs } = useSubscriptions();
  const { data: items } = useItems();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [report, setReport] = React.useState<Report | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [bucket, setBucket] = React.useState<Bucket>("only_google");
  const [visible, setVisible] = React.useState(60);

  React.useEffect(() => {
    if (!open) {
      setReport(null); setFileName(null); setBucket("only_google"); setVisible(60);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);
  React.useEffect(() => { setVisible(60); }, [bucket]);

  // catalog SKU → msrp (₹/seat/mo), for the "only in Google" estimate.
  const priceMap = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items ?? []) m.set(it.name.trim().toLowerCase(), it.msrp ?? 0);
    return m;
  }, [items]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("File too large (>8 MB)."); return; }
    setFileName(file.name);
    try {
      const text = await file.text();
      setReport(buildReport(text, subs ?? [], priceMap));
      setBucket("only_google");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read the file");
    }
  }

  function downloadBucket() {
    if (!report) return;
    const rows = report.buckets[bucket];
    const cols = ["domain", "sku", "seats", "status", "renewal", "est_mrr"] as const;
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [cols.join(",")];
    for (const r of rows) lines.push([r.domain, r.sku, r.seats, r.status, r.renewal, r.estMrr ?? ""].map(esc).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reconcile-${bucket}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }

  const rows = report?.buckets[bucket] ?? [];
  const shown = rows.slice(0, visible);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:!max-w-4xl overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="inline-flex items-center gap-2">
            <Icon name="refresh" size={18} className="text-amber" /> Reconcile with Google
          </DialogTitle>
          <DialogDescription className="break-words">
            Upload the Google reseller-panel export (Partner Sales Console → <b>Download customers</b>).
            We match by <b>domain</b> and show what's out of sync. Read-only — nothing is changed.
          </DialogDescription>
        </DialogHeader>

        {!report && (
          <label htmlFor="recon-file" className={cn(
            "block border-2 border-dashed border-hairline-strong rounded-lg p-8 text-center cursor-pointer hover:bg-paper-2/40 transition-colors",
            "focus-within:ring-2 focus-within:ring-amber",
          )}>
            <Icon name="upload" size={28} className="text-ink-3 mx-auto mb-2" />
            <p className="text-sm font-medium text-ink">Choose the Google customers CSV</p>
            <p className="text-xs text-ink-3 mt-1">Up to 8 MB · the file with a <span className="font-mono">Customer / Sku / Subscription status</span> header</p>
            <input ref={fileRef} id="recon-file" type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
          </label>
        )}

        {report && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Stat label="Google active" value={String(report.googleActive)} />
              <Stat label="In app" value={String(report.appCount)} />
              <Stat label="Matched" value={String(report.buckets.matched.length)} tone="emerald" />
              <Stat label="Only in Google" value={String(report.buckets.only_google.length)} tone="rose" />
              <Stat label="Missing ARR (est.)" value={rupee(report.estMissingMrr * 12, { compact: true })} tone="rose" />
              <Stat label="Suspended vs active" value={String(report.buckets.suspended.length)} tone="amber" />
            </div>
            <p className="text-[11px] text-ink-3">
              "Only in Google" = provisioned on Google but not tracked in the app. <b>Missing ARR is an estimate</b> (catalog price × seats) — verify the real rate before relying on it.
            </p>

            {/* Bucket selector */}
            <div className="flex flex-wrap gap-1.5">
              {BUCKET_META.map((b) => (
                <button key={b.id} type="button" onClick={() => setBucket(b.id)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md border transition-colors",
                    bucket === b.id ? "bg-amber text-white border-amber/0" : "bg-paper border-hairline text-ink-2 hover:bg-paper-2",
                  )}>
                  {b.label} <span className="tabular-nums opacity-80">{report.buckets[b.id].length}</span>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="border border-hairline rounded-md overflow-hidden">
              <div className="max-h-[320px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-paper-2 border-b border-hairline sticky top-0">
                    <tr>
                      <th className="p-2 text-left font-semibold text-ink-3">Domain</th>
                      <th className="p-2 text-left font-semibold text-ink-3">SKU</th>
                      <th className="p-2 text-right font-semibold text-ink-3">Seats</th>
                      <th className="p-2 text-left font-semibold text-ink-3">Status</th>
                      <th className="p-2 text-left font-semibold text-ink-3">Renewal</th>
                      {bucket === "only_google" && <th className="p-2 text-right font-semibold text-ink-3">Est. MRR</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => (
                      <tr key={i} className="border-b border-hairline last:border-0">
                        <td className="p-2 font-mono text-[11px] text-ink">{r.domain}</td>
                        <td className="p-2 text-ink-2">{r.sku}</td>
                        <td className="p-2 text-right tabular-nums text-ink-2">{r.seats}{r.appSeats != null && r.appSeats !== r.seats ? ` (app ${r.appSeats})` : ""}</td>
                        <td className="p-2"><Badge kind={r.status === "Active" ? "success" : "warning"} size="sm" dot>{r.status || "—"}</Badge></td>
                        <td className="p-2 text-ink-2">{r.renewal || "—"}</td>
                        {bucket === "only_google" && <td className="p-2 text-right tabular-nums text-ink-2">{r.estMrr ? rupee(r.estMrr) : "—"}</td>}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-ink-3">Nothing in this bucket 🎉</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length > shown.length && (
                <button type="button" onClick={() => setVisible((v) => v + 100)}
                  className="w-full text-center py-2 text-xs text-amber-ink hover:bg-paper-2/50 border-t border-hairline">
                  Show more ({rows.length - shown.length} left)
                </button>
              )}
            </div>

            <p className="text-[11px] text-ink-3">{fileName} · matched by domain. Read-only — no records changed.</p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {report && (
            <>
              <Button type="button" variant="default" icon="x" onClick={() => { setReport(null); setFileName(null); if (fileRef.current) fileRef.current.value = ""; }}>
                Another file
              </Button>
              <Button type="button" variant="primary" icon="download" onClick={downloadBucket} disabled={rows.length === 0}>
                Download {BUCKET_META.find((b) => b.id === bucket)?.label} ({rows.length})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" | "amber" }) {
  const c = tone === "rose" ? "text-rose" : tone === "emerald" ? "text-emerald" : tone === "amber" ? "text-amber-ink" : "text-ink";
  return (
    <div className="rounded-md border border-hairline bg-paper-2/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums mt-0.5", c)}>{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function normDomain(d: string): string {
  return (d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

function buildReport(text: string, subs: { domain: string | null; status: string }[], priceMap: Map<string, number>): Report {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("CSV needs a header + data rows.");

  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (aliases: string[], contains = false) => {
    for (const a of aliases) {
      const i = contains ? header.findIndex((h) => h.includes(a)) : header.indexOf(a);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iDomain = col(["customer", "domain"]);
  const iSku    = col(["sku"]);
  const iStatus = col(["subscription status", "status"], true);
  const iSeats  = col(["purchased licenses", "purchased"], true);
  const iRenew  = col(["renewal date"], true);
  if (iDomain < 0 || iSku < 0) throw new Error("Couldn't find Customer/Sku columns — is this the Google customers export?");

  // App subscriptions by domain (normalized).
  const appActiveByDomain = new Map<string, number>();   // domain → count of active app subs
  const appAnyDomains = new Set<string>();
  for (const s of subs) {
    if (!s.domain) continue;
    const d = normDomain(s.domain);
    appAnyDomains.add(d);
    if (s.status === "active") appActiveByDomain.set(d, (appActiveByDomain.get(d) ?? 0) + 1);
  }

  const buckets: Record<Bucket, Row[]> = { only_google: [], matched: [], only_app: [], suspended: [] };
  let googleActive = 0, googleSuspended = 0, estMissingMrr = 0;
  const googlePaidDomains = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const sku = (cells[iSku] ?? "").trim();
    if (!sku || sku === "-" || sku.toLowerCase() === "cloud identity free") continue;  // skip non-subs / free
    const domain = normDomain(cells[iDomain] ?? "");
    if (!domain) continue;
    const status = (cells[iStatus] ?? "").trim();
    const seats = Math.max(0, Math.round(Number(cells[iSeats] ?? 0) || 0));
    const renewal = (cells[iRenew] ?? "").trim().replace(/^"|"$/g, "");
    const isActive = /active/i.test(status);
    const isSusp = /suspend/i.test(status);
    if (isActive) googleActive++;
    if (isSusp) googleSuspended++;
    googlePaidDomains.add(domain);

    const inApp = appAnyDomains.has(domain);
    const row: Row = { domain, sku, seats, status: status || "—", renewal };

    if (isSusp && (appActiveByDomain.get(domain) ?? 0) > 0) {
      buckets.suspended.push(row);          // suspended on Google but active in app = billing risk
    }
    if (inApp) {
      buckets.matched.push(row);
    } else {
      const est = (priceMap.get(sku.toLowerCase()) ?? 0) * seats;  // ₹/seat/mo × seats
      row.estMrr = est || undefined;
      if (isActive) estMissingMrr += est;
      buckets.only_google.push(row);
    }
  }

  // Only-in-app: app subs whose domain isn't a paid Google domain.
  for (const s of subs) {
    if (!s.domain) continue;
    const d = normDomain(s.domain);
    if (!googlePaidDomains.has(d)) {
      buckets.only_app.push({ domain: d, sku: "(app subscription)", seats: 0, status: s.status, renewal: "" });
    }
  }

  return { googleActive, googleSuspended, appCount: subs.length, estMissingMrr, buckets };
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
