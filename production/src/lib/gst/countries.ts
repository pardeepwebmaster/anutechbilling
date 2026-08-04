/**
 * Country list for the customer / lead / prospect "Country" selector.
 *
 * A dropdown (not free text) so the value is consistent — `isExportSupply`
 * (place-of-supply.ts) treats anything that isn't India as an export (zero-rated
 * under LUT), so a typo like "U.S.A" vs "USA" must never decide GST. India is
 * pinned first (the default); the rest are common export destinations for Indian
 * cloud resellers (Gulf, US/UK, APAC, Europe) followed by the broader list.
 */

export const COUNTRIES: string[] = [
  "India",
  // Gulf / Middle East — the most common export market for Indian resellers
  "United Arab Emirates",
  "Saudi Arabia",
  "Kuwait",
  "Qatar",
  "Oman",
  "Bahrain",
  // English-speaking / large SaaS markets
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "New Zealand",
  "Singapore",
  "Ireland",
  // APAC
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "Bhutan",
  "Maldives",
  "Malaysia",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Hong Kong",
  "China",
  "Japan",
  "South Korea",
  // Europe
  "Germany",
  "France",
  "Netherlands",
  "Spain",
  "Italy",
  "Switzerland",
  "Sweden",
  "Belgium",
  "Poland",
  "Portugal",
  "Denmark",
  "Norway",
  "Finland",
  // Africa
  "South Africa",
  "Nigeria",
  "Kenya",
  "Egypt",
  "Mauritius",
  // Americas
  "Mexico",
  "Brazil",
  "Argentina",
];
