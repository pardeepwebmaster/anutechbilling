/**
 * Payroll + Leave.
 *
 * Three tabs — Employees, Run payroll, Leave. Salary is booked as a Salaries
 * expense (earned = gross − LOP); only net pay leaves the bank; advance
 * recovery reduces the employee's loan; withheld TDS/PF/ESI is a liability
 * settled via "Pay statutory dues". All money movement is atomic (RPCs 0087).
 */
"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { rupee, formatDate, cn } from "@/lib/utils";
import { useBankAccounts } from "@/lib/queries/bank";
import { useEmployeeLoans } from "@/lib/queries/employee-loans";
import {
  useEmployees, useUpsertEmployee, useSetEmployeePin,
  useLeaveEntries, useCreateLeaveEntry, useDeleteLeaveEntry,
  useSalaryPayments, usePaySalary,
  useStatutoryDues, usePayStatutoryDues,
  useAttendance, useAttendanceNetwork, useSetAttendanceNetwork, getSelfieUrl,
  LEAVE_TYPE_LABEL,
  type Employee, type LeaveKind, type Attendance,
} from "@/lib/queries/payroll";

function todayISO(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function currentPeriod(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 7); // YYYY-MM
}
function fmtTimeIST(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}
function fyStartISO(): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const y = d.getUTCMonth() < 3 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  return `${y}-04-01`;
}
const selectCls = "w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber";

type Tab = "employees" | "payroll" | "leave" | "attendance";

export default function PayrollPage() {
  const [tab, setTab] = React.useState<Tab>("payroll");
  const dues = useStatutoryDues();
  const [payDuesOpen, setPayDuesOpen] = React.useState(false);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      <div className="mb-5">
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Payroll &amp; Leave</h1>
        <p className="text-sm text-ink-3 mt-1">
          Pay salaries, track leave and loss-of-pay. Salary posts as an expense; only net pay leaves your bank.
        </p>
      </div>

      {/* Statutory dues banner */}
      {(dues.data?.payable ?? 0) > 0 && (
        <Card className="mb-5 p-3 md:p-4 border-amber/40 bg-amber-soft/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-2">
              <b className="text-ink">{rupee(dues.data!.payable)}</b> statutory dues withheld (TDS/PF/ESI) — pending payment to govt.
            </div>
            <Button variant="outline" size="sm" onClick={() => setPayDuesOpen(true)}>Record statutory payment</Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-hairline">
        {([["payroll", "Run payroll"], ["employees", "Employees"], ["attendance", "Attendance"], ["leave", "Leave"]] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors",
              tab === k ? "border-amber text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "employees" && <EmployeesTab />}
      {tab === "payroll" && <PayrollTab />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "leave" && <LeaveTab />}

      {payDuesOpen && <PayDuesDialog payable={dues.data?.payable ?? 0} onClose={() => setPayDuesOpen(false)} />}
    </div>
  );
}

// ── Employees tab ─────────────────────────────────────────────────────────
function EmployeesTab() {
  const q = useEmployees();
  const leaveQ = useLeaveEntries();
  const [edit, setEdit] = React.useState<Employee | null | "new">(null);
  const rows = q.data ?? [];

  const paidLeaveTaken = (empId: string) => {
    const fy = fyStartISO();
    return (leaveQ.data ?? [])
      .filter((l) => l.employee_id === empId && l.type !== "unpaid" && l.from_date >= fy)
      .reduce((s, l) => s + l.days, 0);
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button variant="primary" icon="plus" onClick={() => setEdit("new")}>Add employee</Button>
      </div>
      {q.isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="py-2"><EmptyState icon="users" title="No employees yet" body="Add the people you pay a salary to." action={<Button variant="primary" icon="plus" onClick={() => setEdit("new")}>Add employee</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-right px-4 py-3">Monthly salary</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-right px-4 py-3">Paid leave left (FY)</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-paper-2/40">
                  <td className="px-4 py-3 font-medium text-ink">{e.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{rupee(e.monthly_gross)}</td>
                  <td className="px-4 py-3 text-ink-2">{e.joining_date ? formatDate(e.joining_date) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{Math.max(0, e.leave_allowance - paidLeaveTaken(e.id))} / {e.leave_allowance}</td>
                  <td className="px-4 py-3"><Badge kind={e.is_active ? "success" : "muted"} dot>{e.is_active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEdit(e)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {edit !== null && <EmployeeDialog employee={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EmployeeDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const save = useUpsertEmployee();
  const setPin = useSetEmployeePin();
  const [name, setName] = React.useState(employee?.name ?? "");
  const [gross, setGross] = React.useState(String(employee?.monthly_gross ?? ""));
  const [joined, setJoined] = React.useState(employee?.joining_date ?? "");
  const [allowance, setAllowance] = React.useState(String(employee?.leave_allowance ?? 18));
  const [active, setActive] = React.useState(employee?.is_active ?? true);
  const [pin, setPinValue] = React.useState("");

  const pinValid = pin === "" || /^[0-9]{4,6}$/.test(pin);

  async function submit() {
    if (!name.trim() || !pinValid) return;
    const id = await save.mutateAsync({
      id: employee?.id, name: name.trim(), monthly_gross: Math.round(Number(gross) || 0),
      joining_date: joined || null, leave_allowance: Math.round(Number(allowance) || 0), is_active: active,
    });
    if (pin && id) await setPin.mutateAsync({ employeeId: id, pin });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Monthly salary (₹, gross)</label>
            <Input type="number" min={0} value={gross} onChange={(e) => setGross(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Joining date</label>
              <Input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Paid leave / year</label>
              <Input type="number" min={0} value={allowance} onChange={(e) => setAllowance(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">
              Attendance PIN {employee?.pin_hash ? <span className="text-emerald font-normal">· already set</span> : ""}
            </label>
            <Input inputMode="numeric" value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              placeholder={employee?.pin_hash ? "Enter new 4–6 digits to reset" : "Set a 4–6 digit PIN"} maxLength={6} />
            {!pinValid && <p className="mt-1 text-[11px] text-rose">PIN must be 4–6 digits.</p>}
            <p className="mt-1 text-[11px] text-ink-3">Used at the attendance kiosk to check in/out.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-amber" />
            Active
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending || setPin.isPending}>Cancel</Button>
          <Button variant="primary" loading={save.isPending || setPin.isPending} disabled={!name.trim() || !pinValid} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payroll tab ─────────────────────────────────────────────────────────────
function PayrollTab() {
  const [period, setPeriod] = React.useState(currentPeriod());
  const empQ = useEmployees();
  const payQ = useSalaryPayments(period);
  const [payFor, setPayFor] = React.useState<Employee | null>(null);

  const employees = (empQ.data ?? []).filter((e) => e.is_active);
  const paidByEmp = new Map((payQ.data ?? []).map((p) => [p.employee_id, p]));
  const totalNet = (payQ.data ?? []).reduce((s, p) => s + p.net, 0);

  return (
    <>
      <Card className="mb-4 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-ink-3 font-semibold uppercase tracking-wide">Month</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper" />
          <div className="ml-auto text-sm text-ink-2">Paid this month: <b className="text-ink">{rupee(totalNet)}</b></div>
        </div>
      </Card>

      {empQ.isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : employees.length === 0 ? (
        <Card className="py-2"><EmptyState icon="users" title="No active employees" body="Add employees first, then run payroll." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-right px-4 py-3">Monthly salary</th>
                <th className="text-right px-4 py-3">Net paid</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {employees.map((e) => {
                const p = paidByEmp.get(e.id);
                return (
                  <tr key={e.id} className="hover:bg-paper-2/40">
                    <td className="px-4 py-3 font-medium text-ink">{e.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-2">{rupee(e.monthly_gross)}</td>
                    <td className="px-4 py-3 text-right font-mono">{p ? rupee(p.net) : <span className="text-ink-3">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {p ? (
                        <Badge kind="success" dot>Paid</Badge>
                      ) : (
                        <Button variant="primary" size="sm" onClick={() => setPayFor(e)}>Pay salary</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {payFor && <PaySalaryDialog employee={payFor} period={period} onClose={() => setPayFor(null)} />}
    </>
  );
}

function PaySalaryDialog({ employee, period, onClose }: { employee: Employee; period: string; onClose: () => void }) {
  const accountsQ = useBankAccounts();
  const loansQ = useEmployeeLoans();
  const attQ = useAttendance(period);
  const leaveQ = useLeaveEntries();
  const pay = usePaySalary();
  const accounts = (accountsQ.data ?? []).filter((a) => a.is_active);

  // Active advances for this employee (matched by name).
  const advances = (loansQ.data ?? []).filter(
    (l) => l.status === "active" && l.outstanding > 0 && l.employee_name.trim().toLowerCase() === employee.name.trim().toLowerCase(),
  );

  const [gross, setGross]   = React.useState(String(employee.monthly_gross));
  const [lopDays, setLopDays] = React.useState("0");
  const [lopAmt, setLopAmt]   = React.useState("0");
  const [advId, setAdvId]     = React.useState("");
  const [advAmt, setAdvAmt]   = React.useState("0");
  const [tds, setTds]         = React.useState("0");
  const [pf, setPf]           = React.useState("0");
  const [esi, setEsi]         = React.useState("0");
  const [other, setOther]     = React.useState("0");
  const [accountId, setAccountId] = React.useState("");
  const [date, setDate]       = React.useState(todayISO());

  React.useEffect(() => { if (!accountId && accounts.length > 0) setAccountId(accounts[0].id); }, [accounts, accountId]);
  React.useEffect(() => { if (!advId && advances.length > 0) setAdvId(advances[0].id); }, [advances, advId]);

  const n = (s: string) => Math.max(0, Math.round(Number(s) || 0));
  const grossN = n(gross), lopN = n(lopAmt), advN = n(advAmt), tdsN = n(tds), pfN = n(pf), esiN = n(esi), otherN = n(other);
  const earned = Math.max(0, grossN - lopN);
  const net = earned - advN - tdsN - pfN - esiN - otherN;

  const selectedAdv = advances.find((a) => a.id === advId);
  const advTooMuch = advN > 0 && selectedAdv ? advN > selectedAdv.outstanding : false;
  const valid = grossN > 0 && net >= 0 && Boolean(accountId) && !advTooMuch && (advN === 0 || Boolean(advId));

  // Auto-fill LOP amount from days (gross / 30) unless the user overrode it.
  function onLopDays(v: string) {
    setLopDays(v);
    const d = Number(v) || 0;
    setLopAmt(String(Math.round((grossN / 30) * d)));
  }

  // Suggested LOP from attendance + unpaid leave (Sundays are weekly off).
  const lopSuggestion = React.useMemo(() => {
    const [yy, mm] = period.split("-").map(Number);
    const monthStart = new Date(Date.UTC(yy, mm - 1, 1));
    const monthEnd = new Date(Date.UTC(yy, mm, 0));
    const todayUTC = new Date(todayISO() + "T00:00:00Z");
    const rangeEnd = todayUTC < monthEnd ? todayUTC : monthEnd;
    const rangeStart = employee.joining_date && employee.joining_date > `${period}-01`
      ? new Date(employee.joining_date + "T00:00:00Z") : monthStart;
    let expected = 0;
    for (const d = new Date(rangeStart); d <= rangeEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 0) expected++;
    }
    const present = new Set((attQ.data ?? []).filter((a) => a.employee_id === employee.id && a.check_in).map((a) => a.work_date)).size;
    const monthLeaves = (leaveQ.data ?? []).filter((l) => l.employee_id === employee.id && l.from_date <= `${period}-31` && l.to_date >= `${period}-01`);
    const paidLeave = monthLeaves.filter((l) => l.type !== "unpaid").reduce((s, l) => s + l.days, 0);
    const unpaidLeave = monthLeaves.filter((l) => l.type === "unpaid").reduce((s, l) => s + l.days, 0);
    const absent = Math.max(0, expected - present - paidLeave - unpaidLeave);
    return { present, absent, unpaidLeave, lopDays: absent + unpaidLeave };
  }, [period, employee, attQ.data, leaveQ.data]);

  function applyLopSuggestion() {
    onLopDays(String(lopSuggestion.lopDays));
  }

  async function submit() {
    if (!valid) return;
    await pay.mutateAsync({
      employeeId: employee.id, period, payDate: date, gross: grossN,
      lopDays: Number(lopDays) || 0, lopAmount: lopN,
      advanceRecovered: advN, advanceLoanId: advN > 0 ? advId : null,
      tds: tdsN, pf: pfN, esi: esiN, other: otherN, bankAccountId: accountId,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="md:!max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay salary — {employee.name}</DialogTitle>
          <DialogDescription>Period {period}. Net pay leaves the account; deductions are handled correctly.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Gross salary (₹)</label>
              <Input type="number" min={0} value={gross} onChange={(e) => setGross(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Pay from</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
                {accounts.length === 0 && <option value="">Add an account in Banking</option>}
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-md border border-hairline p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Deductions</div>
            <div className="flex items-center justify-between gap-2 rounded bg-paper-2/50 px-2.5 py-1.5 text-[11px] text-ink-3">
              <span>From attendance: <b className="text-ink-2">{lopSuggestion.present}</b> present · <b className="text-ink-2">{lopSuggestion.absent}</b> absent · <b className="text-ink-2">{lopSuggestion.unpaidLeave}</b> unpaid leave → LOP <b className="text-ink">{lopSuggestion.lopDays}d</b></span>
              <button type="button" onClick={applyLopSuggestion} className="shrink-0 rounded border border-hairline px-2 py-0.5 font-medium text-ink hover:bg-paper">Apply</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Unpaid leave (LOP) days</label>
                <Input type="number" min={0} value={lopDays} onChange={(e) => onLopDays(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">LOP amount (₹)</label>
                <Input type="number" min={0} value={lopAmt} onChange={(e) => setLopAmt(e.target.value)} />
              </div>
            </div>
            {advances.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Advance recovery (₹)</label>
                  <Input type="number" min={0} value={advAmt} onChange={(e) => setAdvAmt(e.target.value)} />
                  {advTooMuch && <p className="mt-1 text-[11px] text-rose">Max {rupee(selectedAdv?.outstanding ?? 0)}.</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">From advance</label>
                  <select value={advId} onChange={(e) => setAdvId(e.target.value)} className={selectCls}>
                    {advances.map((a) => <option key={a.id} value={a.id}>{rupee(a.outstanding)} outstanding</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-ink-2 mb-1">TDS (₹)</label><Input type="number" min={0} value={tds} onChange={(e) => setTds(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-ink-2 mb-1">PF (₹)</label><Input type="number" min={0} value={pf} onChange={(e) => setPf(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-ink-2 mb-1">ESI (₹)</label><Input type="number" min={0} value={esi} onChange={(e) => setEsi(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-ink-2 mb-1">Other (₹)</label><Input type="number" min={0} value={other} onChange={(e) => setOther(e.target.value)} /></div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Pay date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="rounded-md bg-paper-2/50 p-3 text-sm space-y-1">
            <Row label="Earned (gross − LOP)" value={rupee(earned)} />
            {advN > 0 && <Row label="− Advance recovery" value={`−${rupee(advN)}`} />}
            {(tdsN + pfN + esiN + otherN) > 0 && <Row label="− TDS / PF / ESI / other" value={`−${rupee(tdsN + pfN + esiN + otherN)}`} />}
            <div className="flex items-center justify-between pt-1 border-t border-hairline font-semibold text-ink">
              <span>Net pay (cash out)</span><span className="font-mono">{rupee(net)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pay.isPending}>Cancel</Button>
          <Button variant="primary" loading={pay.isPending} disabled={!valid} onClick={submit}>Pay {rupee(net > 0 ? net : 0)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-ink-2"><span>{label}</span><span className="font-mono">{value}</span></div>;
}

// ── Leave tab ─────────────────────────────────────────────────────────────
function LeaveTab() {
  const empQ = useEmployees();
  const leaveQ = useLeaveEntries();
  const del = useDeleteLeaveEntry();
  const [addOpen, setAddOpen] = React.useState(false);
  const empName = new Map((empQ.data ?? []).map((e) => [e.id, e.name]));
  const rows = leaveQ.data ?? [];

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)} disabled={(empQ.data ?? []).length === 0}>Record leave</Button>
      </div>
      {leaveQ.isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="py-2"><EmptyState icon="clock" title="No leave recorded" body="Record leave — unpaid leave becomes loss-of-pay in payroll." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">Dates</th>
                <th className="text-right px-4 py-3">Days</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-paper-2/40">
                  <td className="px-4 py-3 font-medium text-ink">{empName.get(l.employee_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2">{formatDate(l.from_date)}{l.to_date !== l.from_date ? ` – ${formatDate(l.to_date)}` : ""}</td>
                  <td className="px-4 py-3 text-right font-mono">{l.days}</td>
                  <td className="px-4 py-3">
                    <Badge kind={l.type === "unpaid" ? "warning" : "info"}>{LEAVE_TYPE_LABEL[l.type]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm("Remove this leave entry?")) del.mutate(l.id); }}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {addOpen && <LeaveDialog employees={empQ.data ?? []} onClose={() => setAddOpen(false)} />}
    </>
  );
}

function LeaveDialog({ employees, onClose }: { employees: Employee[]; onClose: () => void }) {
  const create = useCreateLeaveEntry();
  const [empId, setEmpId] = React.useState(employees[0]?.id ?? "");
  const [from, setFrom]   = React.useState(todayISO());
  const [to, setTo]       = React.useState(todayISO());
  const [days, setDays]   = React.useState("1");
  const [type, setType]   = React.useState<LeaveKind>("casual");
  const [notes, setNotes] = React.useState("");

  const daysN = Number(days) || 0;
  const valid = Boolean(empId) && daysN > 0 && from <= to;

  async function submit() {
    if (!valid) return;
    await create.mutateAsync({ employee_id: empId, from_date: from, to_date: to, days: daysN, type, notes: notes.trim() || null });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>Record leave</DialogTitle>
          <DialogDescription>Unpaid leave becomes loss-of-pay (LOP) in that month&apos;s payroll.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Employee</label>
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} className={selectCls}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-2 mb-1">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-ink-2 mb-1">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Days</label>
              <Input type="number" min={0.5} step={0.5} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as LeaveKind)} className={selectCls}>
                <option value="casual">Casual (paid)</option>
                <option value="sick">Sick (paid)</option>
                <option value="earned">Earned (paid)</option>
                <option value="unpaid">Unpaid (LOP)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Note (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} disabled={!valid} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Attendance tab ──────────────────────────────────────────────────────────
function NetworkCard() {
  const netQ = useAttendanceNetwork();
  const setNet = useSetAttendanceNetwork();
  const d = netQ.data;
  const locked = (d?.allowedIps.length ?? 0) > 0;
  return (
    <Card className={cn("mb-4 p-3 md:p-4", locked ? "border-emerald/30" : "")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink flex items-center gap-2">
            <Icon name="lock" size={14} className={locked ? "text-emerald" : "text-ink-3"} />
            Office network {locked ? "locked" : "not locked"}
          </div>
          <p className="text-[11px] text-ink-3 mt-0.5 max-w-xl">
            {locked
              ? "Attendance can only be marked from the office network(s) below — off-site marking is blocked."
              : "Anyone with the kiosk link can mark from any network. Open this on the office WiFi and lock it to prevent off-site marking."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="primary" size="sm" loading={setNet.isPending} onClick={() => setNet.mutate({ action: "lock" })}>
            Lock to this network
          </Button>
          {locked && <Button variant="ghost" size="sm" onClick={() => setNet.mutate({ action: "clear" })}>Turn off</Button>}
        </div>
      </div>
      {d && (
        <div className="mt-2 text-[11px] text-ink-3">
          This network&apos;s IP: <span className="font-mono text-ink-2">{d.currentIp || "—"}</span>
          {locked && (
            <span className="ml-2">· Allowed:{d.allowedIps.map((ip) => (
              <span key={ip} className="ml-1 font-mono text-ink-2">
                {ip}
                <button onClick={() => setNet.mutate({ action: "remove", ip })} className="ml-0.5 text-rose" aria-label={`Remove ${ip}`}>×</button>
              </span>
            ))}</span>
          )}
        </div>
      )}
    </Card>
  );
}

function AttendanceTab() {
  const [period, setPeriod] = React.useState(currentPeriod());
  const empQ = useEmployees();
  const attQ = useAttendance(period);
  const employees = (empQ.data ?? []).filter((e) => e.is_active);

  const byEmp = new Map<string, { present: number; last: string | null }>();
  for (const a of attQ.data ?? []) {
    const cur = byEmp.get(a.employee_id) ?? { present: 0, last: null };
    if (a.check_in) cur.present += 1;
    if (!cur.last || a.work_date > cur.last) cur.last = a.work_date;
    byEmp.set(a.employee_id, cur);
  }

  return (
    <>
      <NetworkCard />

      <Card className="mb-4 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-ink-3 font-semibold uppercase tracking-wide">Month</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-hairline bg-paper" />
          <Button variant="primary" icon="external" className="ml-auto"
            onClick={() => window.open("/attendance/kiosk", "_blank", "noopener")}>
            Open kiosk
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-ink-3">
          Open the kiosk on your office tablet/phone (kept logged in) — employees tap their name + PIN to check in/out.
          Set each employee&apos;s PIN in the Employees tab.
        </p>
      </Card>

      {empQ.isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : employees.length === 0 ? (
        <Card className="py-2"><EmptyState icon="users" title="No active employees" body="Add employees and set their PINs first." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">PIN</th>
                <th className="text-right px-4 py-3">Days present</th>
                <th className="text-left px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {employees.map((e) => {
                const s = byEmp.get(e.id);
                return (
                  <tr key={e.id} className="hover:bg-paper-2/40">
                    <td className="px-4 py-3 font-medium text-ink">{e.name}</td>
                    <td className="px-4 py-3">
                      {e.pin_hash ? <Badge kind="success">Set</Badge> : <Badge kind="warning">Not set</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{s?.present ?? 0}</td>
                    <td className="px-4 py-3 text-ink-2">{s?.last ? formatDate(s.last) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <TodayCheckins attendance={attQ.data ?? []} employees={employees} />
    </>
  );
}

function TodayCheckins({ attendance, employees }: { attendance: Attendance[]; employees: Employee[] }) {
  const today = todayISO();
  const empName = new Map(employees.map((e) => [e.id, e.name]));
  const rows = attendance.filter((a) => a.work_date === today);
  if (rows.length === 0) return null;
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Today&apos;s check-ins</div>
      <ul className="divide-y divide-hairline">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <span className="font-medium text-ink">{empName.get(a.employee_id) ?? "—"}</span>
            <span className="ml-auto text-xs text-ink-3">In {fmtTimeIST(a.check_in)}{a.check_out ? ` · Out ${fmtTimeIST(a.check_out)}` : ""}</span>
            {a.selfie_in && <SelfieButton path={a.selfie_in} label="in" />}
            {a.selfie_out && <SelfieButton path={a.selfie_out} label="out" />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SelfieButton({ path, label }: { path: string; label: string }) {
  const [loading, setLoading] = React.useState(false);
  async function view() {
    setLoading(true);
    const url = await getSelfieUrl(path);
    setLoading(false);
    if (url) window.open(url, "_blank", "noopener");
  }
  return (
    <button onClick={view} disabled={loading} className="inline-flex items-center gap-1 text-[11px] text-indigo hover:underline disabled:opacity-50">
      <Icon name="eye" size={12} /> {label}
    </button>
  );
}

// ── Pay statutory dues ──────────────────────────────────────────────────────
function PayDuesDialog({ payable, onClose }: { payable: number; onClose: () => void }) {
  const accountsQ = useBankAccounts();
  const pay = usePayStatutoryDues();
  const accounts = (accountsQ.data ?? []).filter((a) => a.is_active);
  const [amount, setAmount] = React.useState(String(payable));
  const [kind, setKind]     = React.useState("mixed");
  const [date, setDate]     = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState("");
  React.useEffect(() => { if (!accountId && accounts.length > 0) setAccountId(accounts[0].id); }, [accounts, accountId]);

  const amt = Math.max(0, Math.round(Number(amount) || 0));
  const tooMuch = amt > payable;
  const valid = amt > 0 && !tooMuch && Boolean(accountId);

  async function submit() {
    if (!valid) return;
    await pay.mutateAsync({ amount: amt, kind, paidOn: date, bankAccountId: accountId });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>Record statutory payment</DialogTitle>
          <DialogDescription>Pay withheld TDS/PF/ESI to govt. Payable: <b className="text-ink">{rupee(payable)}</b>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Amount (₹)</label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            {tooMuch && <p className="mt-1 text-[11px] text-rose">Can&apos;t exceed payable {rupee(payable)}.</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectCls}>
              <option value="mixed">Mixed</option>
              <option value="tds">TDS</option>
              <option value="pf">PF</option>
              <option value="esi">ESI</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Paid from</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pay.isPending}>Cancel</Button>
          <Button variant="primary" loading={pay.isPending} disabled={!valid} onClick={submit}>Pay {amt > 0 && !tooMuch ? rupee(amt) : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
