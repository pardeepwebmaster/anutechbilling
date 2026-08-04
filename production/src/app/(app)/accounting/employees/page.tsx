/**
 * Employees — team management (profiles, salary, documents, leave balance).
 * Split out of the old combined Payroll & Leave page. Renders the shared
 * EmployeesTab screen under a standard HR page shell.
 */
"use client";

import { EmployeesTab, HrPageShell } from "../payroll/screens";

export default function EmployeesPage() {
  return (
    <HrPageShell
      title="Employees"
      sub="Your team — profiles, salary, ID documents (Aadhaar / PAN / resume) and paid-leave balance."
    >
      <EmployeesTab />
    </HrPageShell>
  );
}
