/**
 * Attendance — the admin attendance register + office-network settings.
 * (The employee check-in kiosk lives separately at /attendance/kiosk.)
 * Split out of the old combined Payroll & Leave page.
 */
"use client";

import { AttendanceTab, HrPageShell } from "../payroll/screens";

export default function AttendancePage() {
  return (
    <HrPageShell
      title="Attendance"
      sub="Monthly attendance register + office-network settings. Employees check in at the Attendance Kiosk."
    >
      <AttendanceTab />
    </HrPageShell>
  );
}
