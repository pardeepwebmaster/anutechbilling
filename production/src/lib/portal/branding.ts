/**
 * Portal branding helpers — turn a reseller (tenant) into customer-facing
 * brand bits for the portal chrome. v1 derives everything from existing
 * tenant fields (name, phone) — no logo upload / custom colours yet.
 */

/** Normalise an Indian phone to E.164 digits (e.g. "+91 99999 30300" → "919999930300"). */
export function toE164Digits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = "91" + d;            // bare 10-digit → add India CC
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  return d;
}

/** Human display form: "+91 99999 30300". Falls back to the raw string. */
export function phoneDisplay(phone: string | null | undefined): string | null {
  const d = toE164Digits(phone);
  if (!d) return phone ?? null;
  if (d.length === 12 && d.startsWith("91")) {
    const n = d.slice(2);
    return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  }
  return `+${d}`;
}

/** wa.me link to the reseller with a prefilled message, or null if no phone. */
export function tenantWhatsAppLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const d = toE164Digits(phone);
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}
