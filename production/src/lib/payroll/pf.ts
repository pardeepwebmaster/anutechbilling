/**
 * PF (Employees' Provident Fund / EPF) — statutory retirement contribution.
 *
 * SINGLE SOURCE OF TRUTH for PF rates + ceiling. Mirrors esi.ts. If EPFO revises
 * rates or the wage ceiling, change them HERE only.
 *
 * Rules (current):
 *   • PF wages are capped at ₹15,000/month (the statutory ceiling). Contribution
 *     is computed on min(wage, ₹15,000).
 *   • Employee contributes 12% of PF wages; employer contributes 12%
 *     (internally 8.33% EPS + 3.67% EPF — but the total employer cost is 12%).
 *   • Employer also pays small admin/EDLI charges (~1%) which are NOT modelled in
 *     v1 — the employer figure here is the 12% contribution only. Adjust the
 *     "employer PF" field manually if you want to include admin/EDLI.
 *   • Applies to employees the owner marks PF-applicable (has an EPFO account).
 *
 * Like ESI, employee PF is withheld from net pay; employer PF is an extra
 * company cost that accrues to the statutory payable and is cleared by the PF
 * (ECR) challan — it does not leave the bank at salary time.
 */

export const PF_WAGE_CEILING = 15_000;  // ₹/month — PF computed on min(wage, this)
export const PF_EMPLOYEE_RATE = 0.12;   // 12%
export const PF_EMPLOYER_RATE = 0.12;   // 12% (8.33% EPS + 3.67% EPF)

export interface PfContribution {
  applicable: boolean;
  base: number;      // PF wage the percentages apply to (capped at the ceiling)
  employee: number;  // employee share, 12% (₹)
  employer: number;  // employer share, 12% (₹)
  total: number;     // employee + employer = the PF challan portion (₹)
}

const ZERO = (base: number): PfContribution => ({
  applicable: false, base, employee: 0, employer: 0, total: 0,
});

/**
 * Compute the PF split for a month's wage.
 * @param monthlyWage the month's wage (₹). Contribution is on min(wage, ceiling).
 * @param covered     pass false to exclude an employee with no EPFO account.
 */
export function computePf(monthlyWage: number, covered = true): PfContribution {
  const wage = Math.max(0, Math.round(monthlyWage || 0));
  if (!covered || wage <= 0) return ZERO(wage);
  const base = Math.min(wage, PF_WAGE_CEILING);
  const employee = Math.round(base * PF_EMPLOYEE_RATE);
  const employer = Math.round(base * PF_EMPLOYER_RATE);
  return { applicable: true, base, employee, employer, total: employee + employer };
}
