/**
 * Employee Loans & Advances.
 *
 * A loan to an employee is an ASSET (money owed back), never an expense.
 * Disbursing moves cash OUT of a chosen bank/cash account; repayments (cash /
 * bank) bring it back, while a salary-deduction repayment moves no cash — it
 * just reduces the outstanding. Total outstanding shows up as an asset on the
 * Balance Sheet automatically. All cash movement is atomic (migration 0085).
 */
"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FAB } from "@/components/ui/fab";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { rupee, formatDate } from "@/lib/utils";
import { useBankAccounts } from "@/lib/queries/bank";
import {
  useEmployeeLoans,
  useDisburseLoan,
  useRecordLoanRepayment,
  useLoanRepayments,
  type EmployeeLoan,
  type LoanRepaymentMethod,
} from "@/lib/queries/employee-loans";

function todayISO(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

const METHOD_LABEL: Record<LoanRepaymentMethod, string> = {
  cash: "Cash", bank: "Bank transfer", salary_deduction: "Salary deduction",
};

export default function EmployeeLoansPage() {
  const q = useEmployeeLoans();
  const [disburseOpen, setDisburseOpen] = React.useState(false);
  const [repayFor, setRepayFor] = React.useState<EmployeeLoan | null>(null);

  const loans     = q.data ?? [];
  const isLoading = q.isLoading;

  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
  const activeCount       = loans.filter((l) => l.status === "active").length;
  const totalDisbursed    = loans.reduce((s, l) => s + l.principal, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Employee Loans &amp; Advances</h1>
          <p className="text-sm text-ink-3 mt-1">
            Money lent to staff — an asset the company is owed back, not an expense. Cash moves through your bank/cash accounts and the outstanding shows on the Balance Sheet.
          </p>
        </div>
        <Button variant="primary" icon="plus" className="hidden md:inline-flex" onClick={() => setDisburseOpen(true)}>
          Give loan
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <KPI label="Outstanding (owed back)" value={rupee(totalOutstanding)} tone="amber" />
        <KPI label="Active loans" value={String(activeCount)} />
        <KPI label="Total disbursed" value={rupee(totalDisbursed)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : loans.length === 0 ? (
        <Card className="py-2">
          <EmptyState
            icon="rupee"
            title="No employee loans yet"
            body="Record a loan or advance you've given a team member. It's tracked as money owed back — repayments reduce it, and the balance shows as an asset."
            action={<Button variant="primary" icon="plus" onClick={() => setDisburseOpen(true)}>Give a loan</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper-2/50 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                <tr>
                  <th className="text-left  px-4 py-3">Employee</th>
                  <th className="text-left  px-4 py-3">Disbursed</th>
                  <th className="text-right px-4 py-3">Principal</th>
                  <th className="text-right px-4 py-3">Repaid</th>
                  <th className="text-right px-4 py-3">Outstanding</th>
                  <th className="text-left  px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-paper-2/40">
                    <td className="px-4 py-3 text-ink font-medium">
                      {l.employee_name}
                      {l.notes && <div className="text-[11px] text-ink-3 font-normal">{l.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{formatDate(l.disbursed_on)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-2">{rupee(l.principal)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald">{l.repaid > 0 ? rupee(l.repaid) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ink">{rupee(l.outstanding)}</td>
                    <td className="px-4 py-3">
                      <Badge kind={l.status === "closed" ? "success" : "warning"} dot>
                        {l.status === "closed" ? "Cleared" : "Active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {l.status === "active" ? (
                        <Button variant="ghost" size="sm" onClick={() => setRepayFor(l)}>Record repayment</Button>
                      ) : (
                        <span className="text-[11px] text-ink-3">Fully repaid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-2.5">
            {loans.map((l) => (
              <li key={l.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-ink leading-tight">{l.employee_name}</div>
                    <div className="font-serif text-xl text-ink leading-none">{rupee(l.outstanding)}</div>
                  </div>
                  <div className="text-[11px] text-ink-3 mb-2">
                    {formatDate(l.disbursed_on)} · {rupee(l.principal)} lent · {rupee(l.repaid)} repaid
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge kind={l.status === "closed" ? "success" : "warning"} dot>
                      {l.status === "closed" ? "Cleared" : "Active"}
                    </Badge>
                    {l.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => setRepayFor(l)}>Record repayment</Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <FAB icon="plus" label="Loan" onClick={() => setDisburseOpen(true)} ariaLabel="Give loan" />
      {disburseOpen && <DisburseDialog onClose={() => setDisburseOpen(false)} />}
      {repayFor && <RepaymentDialog loan={repayFor} onClose={() => setRepayFor(null)} />}
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "amber" | "emerald" }) {
  const color = tone === "amber" ? "text-amber" : tone === "emerald" ? "text-emerald" : "text-ink";
  return (
    <Card className="p-3 md:p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">{label}</div>
      <div className={`font-serif text-xl md:text-2xl ${color} leading-tight`}>{value}</div>
    </Card>
  );
}

const selectCls = "w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber";

function DisburseDialog({ onClose }: { onClose: () => void }) {
  const accountsQ = useBankAccounts();
  const disburse  = useDisburseLoan();
  const accounts  = (accountsQ.data ?? []).filter((a) => a.is_active);

  const [name, setName]         = React.useState("");
  const [amount, setAmount]     = React.useState("");
  const [date, setDate]         = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState("");
  const [notes, setNotes]       = React.useState("");

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const amt = Math.round(Number(amount));

  async function submit() {
    if (!name.trim()) return;
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (!accountId) return;
    await disburse.mutateAsync({
      employeeName: name.trim(), principal: amt, disbursedOn: date, bankAccountId: accountId, notes: notes.trim() || null,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>Give a loan / advance</DialogTitle>
          <DialogDescription>Money leaves the chosen account and is tracked as owed back to you.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Employee name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Amount (₹)</label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Paid from</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
              {accounts.length === 0 && <option value="">No accounts — add one in Banking</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.current_balance != null ? ` · ${rupee(a.current_balance)}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Note (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. medical advance, interest-free" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={disburse.isPending}>Cancel</Button>
          <Button
            variant="primary"
            loading={disburse.isPending}
            disabled={!name.trim() || !(amt > 0) || !accountId}
            onClick={submit}
          >
            Give {amt > 0 ? rupee(amt) : "loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepaymentDialog({ loan, onClose }: { loan: EmployeeLoan; onClose: () => void }) {
  const accountsQ = useBankAccounts();
  const repay     = useRecordLoanRepayment();
  const historyQ  = useLoanRepayments(loan.id);
  const accounts  = (accountsQ.data ?? []).filter((a) => a.is_active);

  const [amount, setAmount] = React.useState(String(loan.outstanding));
  const [date, setDate]     = React.useState(todayISO());
  const [method, setMethod] = React.useState<LoanRepaymentMethod>("cash");
  const [accountId, setAccountId] = React.useState("");
  const [notes, setNotes]   = React.useState("");

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const amt = Math.round(Number(amount));
  const needsAccount = method === "cash" || method === "bank";
  const tooMuch = amt > loan.outstanding;
  const valid = amt > 0 && !tooMuch && (!needsAccount || Boolean(accountId));

  async function submit() {
    if (!valid) return;
    await repay.mutateAsync({
      loanId: loan.id, amount: amt, repaidOn: date, method,
      bankAccountId: needsAccount ? accountId : null, notes: notes.trim() || null,
    });
    onClose();
  }

  const history = historyQ.data ?? [];

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="md:!max-w-md">
        <DialogHeader>
          <DialogTitle>Record repayment — {loan.employee_name}</DialogTitle>
          <DialogDescription>
            Outstanding: <b className="text-ink">{rupee(loan.outstanding)}</b> of {rupee(loan.principal)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Amount (₹)</label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            {tooMuch && <p className="mt-1 text-[11px] text-rose">Can&apos;t exceed the outstanding {rupee(loan.outstanding)}.</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Repaid via</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as LoanRepaymentMethod)} className={selectCls}>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="salary_deduction">Salary deduction (no cash moves)</option>
            </select>
          </div>
          {needsAccount && (
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Received in</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
                {accounts.length === 0 && <option value="">No accounts — add one in Banking</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Note (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {history.length > 0 && (
            <div className="rounded-md border border-hairline bg-paper-2/40 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1.5">Repayments so far</div>
              <ul className="space-y-1">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-xs text-ink-2">
                    <span>{formatDate(h.repaid_on)} · {METHOD_LABEL[h.method]}</span>
                    <span className="font-mono text-emerald">{rupee(h.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={repay.isPending}>Cancel</Button>
          <Button variant="primary" loading={repay.isPending} disabled={!valid} onClick={submit}>
            Record {amt > 0 && !tooMuch ? rupee(amt) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
