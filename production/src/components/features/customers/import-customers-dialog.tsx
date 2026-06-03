/**
 * ImportCustomersDialog — bulk-import customers from a .csv file.
 *
 * Built for migrating from Zoho Books (and similar): the column matcher
 * recognises both a simple ResellerOS header AND common Zoho export headers
 * (Display Name / Company Name / EmailID / MobilePhone / GST Identification
 * Number (GSTIN) / Billing State), so a Zoho "Contacts" CSV imports cleanly
 * without renaming columns.
 *
 * Fields mapped → customers: name (required), contact_name, contact_email,
 * contact_phone, gstin, state, state_code (derived from state name).
 *
 * Dedup: rows whose email already belongs to an existing customer in this
 * tenant are flagged "already exists" and skipped (also de-dupes within the
 * file). Mirrors the lead-import safeguards.
 *
 * Parser is the same hand-rolled CSV reader used by the lead importer
 * (quoted strings + escaped quotes + BOM strip). Export from Zoho as CSV,
 * or Save-As CSV from Excel.
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
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { cn, GST_STATE_BY_CODE } from "@/lib/utils";

const CSV_HEADER = "name,contact_name,contact_email,contact_phone,gstin,state";
const SAMPLE_CSV = [
  CSV_HEADER,
  `TechFlow Solutions,Rajesh Verma,rajesh@techflow.in,+91 98765 43210,07AABFT1234R1ZP,Delhi`,
  `CloudBridge Systems,Sunita Agarwal,sunita@cloudbridge.in,+91 98112 23344,07AACCS5678K1ZM,Delhi`,
  `"Rajan Tech Solutions, LLP",Rajan Kumar,rajan@rajantech.com,+91 90000 11111,27AABCU9603R1ZX,Maharashtra`,
].join("\n");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// state name (lowercased) → GST state code, derived from the canonical map.
const STATE_NAME_TO_CODE: Record<string, string> = Object.entries(GST_STATE_BY_CODE)
  .reduce((acc, [code, name]) => { acc[name.toLowerCase()] = code; return acc; }, {} as Record<string, string>);

interface ParsedRow {
  rowNum: number;
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  gstin?: string;
  state?: string;
  state_code?: string;
  error?: string;     // blocks import
  warning?: string;   // imports but flagged
  dup?: boolean;      // already exists → skipped
}

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function ImportCustomersDialog({ open, onOpenChange, onImportComplete }: ImportCustomersDialogProps) {
  const { data: me } = useCurrentUser();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = React.useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [existingEmails, setExistingEmails] = React.useState<Set<string>>(new Set());

  // Load existing customer emails (this tenant, via RLS) so we can flag dupes.
  React.useEffect(() => {
    if (!open) {
      setParsed(null);
      setFileName(null);
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("customers").select("contact_email");
      const set = new Set<string>();
      (data ?? []).forEach((c) => {
        if (c.contact_email) set.add(c.contact_email.trim().toLowerCase());
      });
      setExistingEmails(set);
    })();
  }, [open]);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers-sample.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large (>2 MB). Split into smaller files.");
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCustomersCsv(text, existingEmails);
      if (rows.length === 0) {
        toast.error("No rows found. Make sure the file has a header + data rows.");
        return;
      }
      setParsed(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read the file");
    }
  };

  const handleImport = async () => {
    if (!parsed || !me) return;
    const valid = parsed.filter((r) => !r.error && !r.dup);
    if (valid.length === 0) {
      toast.error("No new customers to import.");
      return;
    }
    setImporting(true);
    try {
      const supabase = createClient();
      const payload = valid.map((r) => ({
        tenant_id: me.tenantId,
        name: r.name,
        contact_name: r.contact_name || null,
        contact_email: r.contact_email || null,
        contact_phone: r.contact_phone || null,
        gstin: r.gstin || null,
        state: r.state || null,
        state_code: r.state_code || null,
      }));
      const { error } = await supabase.from("customers").insert(payload);
      if (error) throw error;

      const skipped = parsed.length - valid.length;
      toast.success(
        `Imported ${valid.length} customer${valid.length === 1 ? "" : "s"}` +
        (skipped > 0 ? ` · ${skipped} skipped` : ""),
      );
      onImportComplete?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsed?.filter((r) => !r.error && !r.dup).length ?? 0;
  const dupCount   = parsed?.filter((r) => r.dup && !r.error).length ?? 0;
  const errorCount = parsed?.filter((r) => r.error).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:!max-w-2xl overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words inline-flex items-center gap-2">
            <Icon name="download" size={18} className="text-amber" />
            Import customers
          </DialogTitle>
          <DialogDescription className="break-words">
            Upload a CSV (export your contacts from Zoho Books as CSV, or Save-As CSV from Excel).
            We map common Zoho columns automatically.
          </DialogDescription>
        </DialogHeader>

        {!parsed && (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-soft/60 border border-amber/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-amber-ink min-w-0">
                <p className="font-semibold">Pehli baar? Sample file download karo.</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Header + example rows. Zoho ka export bhi seedha chalega.
                </p>
              </div>
              <Button type="button" variant="default" size="sm" icon="download"
                onClick={downloadSample} className="sm:shrink-0 w-full sm:w-auto justify-center">
                Download sample.csv
              </Button>
            </div>

            <label htmlFor="cust-csv-file" className={cn(
              "block border-2 border-dashed border-hairline-strong rounded-lg",
              "p-8 text-center cursor-pointer hover:bg-paper-2/40 transition-colors",
              "focus-within:ring-2 focus-within:ring-amber focus-within:ring-offset-2",
            )}>
              <Icon name="upload" size={28} className="text-ink-3 mx-auto mb-2" />
              <p className="text-sm font-medium text-ink">Choose a CSV file</p>
              <p className="text-xs text-ink-3 mt-1">Up to 2 MB</p>
              <input ref={fileInputRef} id="cust-csv-file" type="file" accept=".csv,text/csv"
                onChange={handleFileChange} className="sr-only" />
            </label>

            <div className="text-xs text-ink-3">
              <p className="font-semibold uppercase tracking-wider mb-1.5 text-[10px]">Recognised columns</p>
              <code className="block bg-paper-2 border border-hairline rounded-md px-3 py-2 font-mono text-[11px] overflow-x-auto">
                {CSV_HEADER}
              </code>
              <p className="mt-2">
                Also accepts Zoho headers: Display Name / Company Name / EmailID / MobilePhone /
                GST Identification Number (GSTIN) / Billing State. Only a <span className="font-semibold text-ink">name</span> is required.
              </p>
            </div>
          </div>
        )}

        {parsed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-ink min-w-0">
                <p className="font-semibold truncate">{fileName}</p>
                <p className="text-xs text-ink-3 mt-0.5 inline-flex items-center gap-2 flex-wrap">
                  <Badge kind="success" size="sm">{validCount} new</Badge>
                  {dupCount > 0 && <Badge kind="warning" size="sm">{dupCount} already exist</Badge>}
                  {errorCount > 0 && <Badge kind="danger" size="sm">{errorCount} skipped</Badge>}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" icon="x"
                onClick={() => { setParsed(null); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                Choose another file
              </Button>
            </div>

            <div className="border border-hairline rounded-md overflow-hidden">
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-paper-2 border-b border-hairline sticky top-0">
                    <tr>
                      <th className="p-2 text-left font-semibold text-ink-3 w-8">#</th>
                      <th className="p-2 text-left font-semibold text-ink-3">Name</th>
                      <th className="p-2 text-left font-semibold text-ink-3">Email</th>
                      <th className="p-2 text-left font-semibold text-ink-3">GSTIN</th>
                      <th className="p-2 text-left font-semibold text-ink-3">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r) => (
                      <tr key={r.rowNum} className={cn(
                        "border-b border-hairline last:border-0",
                        r.error && "bg-rose/5",
                        r.dup && !r.error && "bg-amber-soft/40",
                      )}>
                        <td className="p-2 text-ink-3 tabular-nums">{r.rowNum}</td>
                        <td className="p-2">
                          {r.error ? (
                            <span className="text-rose inline-flex items-center gap-1">
                              <Icon name="alert" size={11} />{r.error}
                            </span>
                          ) : (
                            <span className="font-medium text-ink">
                              {r.name}
                              {r.dup && <span className="ml-1.5 text-[10px] text-amber-ink">(already exists)</span>}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-ink-2 font-mono">{r.contact_email || <span className="text-ink-3 font-sans">—</span>}</td>
                        <td className="p-2 text-ink-2 font-mono text-[10px]">{r.gstin || <span className="text-ink-3 font-sans">—</span>}</td>
                        <td className="p-2 text-ink-2">{r.state || <span className="text-ink-3">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-ink-3">
              New customers import into <span className="font-semibold text-ink">{me?.tenantName ?? "your tenant"}</span>.
              Rows whose email already exists are skipped (no duplicates).
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          {parsed && validCount > 0 && (
            <Button type="button" variant="primary" loading={importing} onClick={handleImport}>
              Import {validCount} customer{validCount === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CSV parsing — hand-rolled (same reader as the lead importer).
// Recognises ResellerOS + Zoho Books column names.
// ============================================================
function parseCustomersCsv(text: string, existingEmails: Set<string>): ParsedRow[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("CSV needs a header row + at least one data row.");

  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const col = (aliases: string[]): number => {
    for (const a of aliases) { const i = header.indexOf(a); if (i >= 0) return i; }
    return -1;
  };

  const idxCompany = col(["company name", "company_name", "company"]);
  const idxDisplay = col(["name", "display name", "display_name", "customer name", "customer_name"]);
  const idxContact = col(["contact_name", "contact name", "primary contact", "contact person", "first name"]);
  const idxEmail   = col(["contact_email", "email", "emailid", "email id", "email address"]);
  const idxPhone   = col(["contact_phone", "phone", "mobilephone", "mobile phone", "mobile"]);
  const idxGstin   = col(["gstin", "gst_no", "gst no", "gst identification number (gstin)", "gst identification number", "gst"]);
  const idxState   = col(["state", "billing state", "place of supply", "place_of_contact", "shipping state"]);

  if (idxCompany === -1 && idxDisplay === -1 && idxContact === -1) {
    throw new Error("Couldn't find a name column (name / Display Name / Company Name).");
  }

  const seen = new Set<string>();
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const rowNum = i + 1;
    const cell = (idx: number) => (idx >= 0 ? (cols[idx] ?? "").trim() : "");

    const company = cell(idxCompany);
    const display = cell(idxDisplay);
    const contact = cell(idxContact);
    const name = company || display || contact;
    if (!name) {
      rows.push({ rowNum, name: "", error: "Missing name" });
      continue;
    }

    const email = cell(idxEmail);
    const state = cell(idxState);
    const stateCode = state ? (STATE_NAME_TO_CODE[state.toLowerCase()] ?? undefined) : undefined;
    const emailKey = email.toLowerCase();

    let dup = false;
    if (email) {
      if (existingEmails.has(emailKey) || seen.has(emailKey)) dup = true;
      seen.add(emailKey);
    }

    rows.push({
      rowNum,
      name,
      contact_name: (contact || display) || undefined,
      contact_email: email || undefined,
      contact_phone: cell(idxPhone) || undefined,
      gstin: cell(idxGstin) || undefined,
      state: state || undefined,
      state_code: stateCode,
      dup,
      warning: email && !EMAIL_RE.test(email) ? "email looks malformed" : undefined,
    });
  }
  return rows;
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
