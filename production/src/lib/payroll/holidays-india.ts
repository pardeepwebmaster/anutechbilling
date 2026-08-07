/**
 * Indian national gazetted holidays that fall on the SAME date every year, so
 * they can be auto-applied without guessing. An absence on one of these is
 * never docked as loss-of-pay.
 *
 * Variable-date festival holidays (Diwali, Holi, Eid, Good Friday, …) shift
 * every year and are NOT hard-coded here — guessing a wrong date would dock
 * salary incorrectly. Add those to the company Holiday list (Leave Register)
 * each year; they're honoured the same way.
 */
export const FIXED_NATIONAL_HOLIDAYS: { md: string; name: string }[] = [
  { md: "01-26", name: "Republic Day" },
  { md: "08-15", name: "Independence Day" },
  { md: "10-02", name: "Gandhi Jayanti" },
];

/** ISO dates (YYYY-MM-DD) of the fixed national holidays for a calendar year. */
export function nationalHolidaysForYear(year: number): string[] {
  return FIXED_NATIONAL_HOLIDAYS.map((h) => `${year}-${h.md}`);
}
