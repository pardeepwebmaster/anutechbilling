/**
 * Payroll — run monthly payroll (+ statutory-dues banner). Part of the HR
 * section. All the HR screen bodies live in ./screens so the Employees / Leave
 * / Attendance routes can share the same components + dialogs.
 */
"use client";

import { PayrollScreen } from "./screens";

export default function PayrollPage() {
  return <PayrollScreen />;
}
