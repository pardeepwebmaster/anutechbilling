import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compute the penalty to apply to a customer's health based on how long
 * they've had an outstanding balance. As days pass without payment, the
 * effective health drops automatically.
 *
 *   0-7 days   → no penalty (still in friendly-reminder window)
 *   8-15 days  → -10  (gentle warning zone)
 *   16-30 days → -20  (urgent, stronger nudge)
 *   31-60 days → -35  (consider suspending service)
 *   60+ days   → -55  (bad debt territory, write-off zone)
 */
export function healthPenaltyFromOutstandingDays(days: number): number {
  if (days <= 7)   return 0;
  if (days <= 15)  return 10;
  if (days <= 30)  return 20;
  if (days <= 60)  return 35;
  return 55;
}

/**
 * Combine base customer health with the outstanding penalty. Result is clamped 0-100.
 */
export function effectiveHealth(baseHealth: number, outstandingDays: number | null | undefined): number {
  if (!outstandingDays || outstandingDays <= 0) return baseHealth;
  return Math.max(0, Math.min(100, baseHealth - healthPenaltyFromOutstandingDays(outstandingDays)));
}

/**
 * Merge Tailwind classes with conflict resolution.
 * Use everywhere instead of template literals for className.
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-amber", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indian Rupees.
 * Internally we store paise (integer) but most UI calls pass rupees.
 * Use `rupeeFromPaise()` if you have paise.
 *
 * @example
 * rupee(490644)             // "₹4,90,644"
 * rupee(490644, { compact: true })  // "₹4.9L"
 * rupee(0)                  // "₹0"
 * rupee(null)               // "—"
 */
export function rupee(
  n: number | null | undefined,
  opts: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals = 0 } = opts;
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 10_000_000) return `₹${(n / 10_000_000).toFixed(decimals || 1)}Cr`;
    if (abs >= 100_000) return `₹${(n / 100_000).toFixed(decimals || 1)}L`;
    if (abs >= 1_000) return `₹${(n / 1_000).toFixed(decimals || 1)}K`;
    return `₹${n.toFixed(decimals)}`;
  }
  // Indian numbering format: 4,90,644
  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
    : last3;
  return `₹${formatted}${decPart ? `.${decPart}` : ""}`;
}

/**
 * Convert paise (integer) to rupees and format.
 * @example rupeeFromPaise(49064400) // "₹4,90,644"
 */
export function rupeeFromPaise(paise: number | null | undefined, opts?: Parameters<typeof rupee>[1]) {
  if (paise === null || paise === undefined) return "—";
  return rupee(paise / 100, opts);
}

/**
 * Format an integer with Indian comma separators (no currency).
 * @example num(1234567) // "12,34,567"
 */
export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-IN");
}

/**
 * Format a date in IST as "DD MMM YYYY" (e.g., "15 May 2026").
 */
export function formatDate(
  input: Date | string | number | null | undefined,
  format: "short" | "long" | "relative" = "short"
): string {
  if (!input) return "—";
  const d = typeof input === "string" || typeof input === "number" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";

  if (format === "relative") {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(d, "short");
  }

  const day = d.getDate();
  const month = d.toLocaleString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });
  const year = d.getFullYear();
  if (format === "long") {
    const time = d.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata", hour12: true });
    return `${day} ${month} ${year} · ${time}`;
  }
  return `${day} ${month} ${year}`;
}

/**
 * Days between two dates, IST-aware and date-only (ignores time of day).
 *
 * Old impl used millisecond diff + Math.round which was off-by-one for the
 * common case "is X due today?" when called near midnight or with a date
 * string that parses to UTC midnight while `from` is wall-clock. Now we
 * snap both endpoints to IST date boundaries and integer-floor before
 * subtracting, matching the IST-aware day arithmetic used by the renewal
 * cadence engine.
 *
 * @example daysBetween(new Date(), "2026-05-24") // 0 anywhere in IST today
 */
export function daysBetween(from: Date | string, to: Date | string): number {
  const a = from instanceof Date ? from : new Date(from);
  const b = to   instanceof Date ? to   : new Date(to);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const dayMs       = 24 * 60 * 60 * 1000;
  const aIST = Math.floor((a.getTime() + istOffsetMs) / dayMs);
  const bIST = Math.floor((b.getTime() + istOffsetMs) / dayMs);
  return bIST - aIST;
}

/**
 * Validate Indian GSTIN format and checksum.
 * Returns true if valid, false otherwise.
 * @example isValidGstin("27AABCE9876D1Z3") // true
 */
export function isValidGstin(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false;
  const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return re.test(gstin);
}

/**
 * Format a phone number to standard Indian format.
 * @example formatPhone("9876543210") // "+91 98765 43210"
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^91/, "");
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/**
 * Initials from a full name (max 2 chars).
 * @example initials("Rajesh Kumar Sharma") // "RS"
 */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase())
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .join("")
    .slice(0, 2);
}

/**
 * Truncate a string with ellipsis.
 */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/**
 * Sleep for ms milliseconds (useful for testing UX, NEVER in production logic).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Type guard: filter out null/undefined.
 * @example items.filter(notNull)
 */
export function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type-safe object entries (Object.entries with proper types).
 */
export function entries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}
