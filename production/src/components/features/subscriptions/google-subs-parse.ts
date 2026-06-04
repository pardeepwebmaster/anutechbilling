/**
 * Pure parsing + classification for the Google→app subscription matcher.
 * No React / UI imports, so it's unit-testable in isolation. The dialog
 * (import-google-subs-dialog.tsx) consumes these.
 *
 * MONEY-HONESTY: the Google export carries NO price. estMrr is an ESTIMATE
 * (catalog msrp × seats); the UI flags it and never presents it as confirmed.
 */
export type Category = "link" | "new" | "in_app";

export interface GRow {
  rowNum: number;
  domain: string;
  customer_number: string;
  plan: string;          // SKU
  seats: number;
  estMrr: number;        // catalog msrp × seats (monthly, ESTIMATE)
  status: "active" | "paused";   // Google "Suspended" → paused (closest app status)
  start_date?: string;
  renewal_date?: string;
  category: Category;
  customer_id?: string;  // link
  customer_name?: string;
}

export interface Parsed {
  rows: GRow[];
  custNumHeader: string | null;   // which column we matched as the customer number
  skippedFree: number;            // Cloud Identity Free / blank-SKU rows ignored
}

export interface Lookups {
  byNumber: Map<string, { id: string; name: string }>;
  byDomain: Map<string, { id: string; name: string }>;
  appSubDomains: Set<string>;
}

export function normDomain(s: string): string {
  return (s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

/** Google panel dates look like "November 27, 2026" — Date can parse these. */
export function gDate(s: string): string | undefined {
  const t = (s || "").trim().replace(/^"|"$/g, "");
  if (!t || t === "-") return undefined;
  const d = new Date(t);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export function parseGoogle(text: string, lk: Lookups, priceMap: Map<string, number>): Parsed {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV needs a header + at least one data row.");

  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const rawHeader = parseLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const find = (pred: (h: string) => boolean) => header.findIndex(pred);

  const iDomain = find((h) => h === "customer" || h.includes("domain"));
  const iSku    = find((h) => h === "sku");
  const iStatus = find((h) => h.includes("subscription status"));
  const iSeats  = find((h) => h.includes("purchased"));
  const iRenew  = find((h) => h.includes("renewal"));
  const iCreate = find((h) => h.includes("creation"));
  // Customer-number column: must NOT be the "Customer" (domain) column.
  const iNum = find((h) =>
    (h.includes("customer number") || h === "customer_number" || h === "customer no" ||
     h === "customer id" || h === "account number" || h === "reference" || h === "ref" || h === "ref no"));

  if (iDomain === -1) throw new Error("Couldn't find the 'Customer' (domain) column.");
  if (iSku === -1) throw new Error("Couldn't find the 'Sku' column.");

  const rows: GRow[] = [];
  let skippedFree = 0;

  for (let i = 1; i < lines.length; i++) {
    const c = parseLine(lines[i]);
    const sku = (c[iSku] ?? "").trim();
    if (!sku || sku === "-" || sku.toLowerCase() === "cloud identity free") { skippedFree++; continue; }
    const domain = normDomain(c[iDomain] ?? "");
    if (!domain) continue;
    const statusRaw = (c[iStatus] ?? "").trim();
    const status: GRow["status"] = /suspend/i.test(statusRaw) ? "paused" : "active";
    const seats = Math.max(0, Math.round(Number(c[iSeats] ?? 0) || 0));
    const customer_number = iNum >= 0 ? (c[iNum] ?? "").trim() : "";
    const estMrr = Math.round((priceMap.get(sku.toLowerCase()) ?? 0) * seats);

    // Classify.
    let category: Category;
    let customer_id: string | undefined;
    let customer_name: string | undefined;
    if (lk.appSubDomains.has(domain)) {
      category = "in_app";   // a subscription on this domain is already tracked
    } else {
      const byNum = customer_number ? lk.byNumber.get(customer_number.toLowerCase()) : undefined;
      const match = byNum ?? lk.byDomain.get(domain);
      if (match) { category = "link"; customer_id = match.id; customer_name = match.name; }
      else category = "new";
    }

    rows.push({
      rowNum: i + 1, domain, customer_number, plan: sku, seats, estMrr, status,
      start_date: gDate(c[iCreate] ?? ""),
      renewal_date: gDate(c[iRenew] ?? ""),
      category, customer_id, customer_name,
    });
  }

  // Sort: actionable first (link, then new), already-in-app last.
  const order: Record<Category, number> = { link: 0, new: 1, in_app: 2 };
  rows.sort((a, b) => order[a.category] - order[b.category]);

  return { rows, custNumHeader: iNum >= 0 ? rawHeader[iNum] : null, skippedFree };
}

export function parseLine(line: string): string[] {
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
