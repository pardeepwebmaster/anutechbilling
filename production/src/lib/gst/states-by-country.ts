/**
 * States / provinces / emirates by country — so the customer form can offer a
 * proper dropdown instead of free text (which let a Kuwait customer be saved
 * with "california"). Keyed by the exact country names in `countries.ts`.
 *
 * India is intentionally NOT here — the customer form derives the Indian state
 * (with its GST state code) from the GSTIN, which is the compliant source.
 * Foreign state is display-only (export supplies are zero-rated), so a wrong
 * value has no GST impact — this is purely a data-quality convenience.
 *
 * Countries absent from this map fall back to a free-text input.
 */

export const STATES_BY_COUNTRY: Record<string, string[]> = {
  "United Arab Emirates": [
    "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah",
  ],
  "Saudi Arabia": [
    "Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk", "Hail",
    "Northern Borders", "Jazan", "Najran", "Al Bahah", "Al Jawf", "Qassim",
  ],
  "Kuwait": [
    "Al Asimah (Capital)", "Hawalli", "Farwaniya", "Mubarak Al-Kabeer", "Ahmadi", "Jahra",
  ],
  "Qatar": [
    "Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Al Shamal", "Al Daayen", "Umm Salal",
    "Al Shahaniya",
  ],
  "Oman": [
    "Muscat", "Dhofar", "Musandam", "Al Buraimi", "Al Dakhiliyah", "Al Batinah North",
    "Al Batinah South", "Al Sharqiyah North", "Al Sharqiyah South", "Al Dhahirah", "Al Wusta",
  ],
  "Bahrain": ["Capital", "Muharraq", "Northern", "Southern"],

  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
    "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
    "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  "Canada": [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
    "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
    "Northwest Territories", "Nunavut", "Yukon",
  ],
  "Australia": [
    "Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland",
    "South Australia", "Tasmania", "Victoria", "Western Australia",
  ],
};

/** States for a country, or null when we don't have a list (→ use a free-text input). */
export function getStatesForCountry(country: string | null | undefined): string[] | null {
  if (!country) return null;
  return STATES_BY_COUNTRY[country.trim()] ?? null;
}
