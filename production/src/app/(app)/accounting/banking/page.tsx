/**
 * Banking — bank accounts landing page.
 *
 * Lists every bank account the operator has connected. Each card shows
 * the account nickname, bank logo + IFSC, last-4 digits, current balance
 * (= opening_balance + sum of credit-debit across imported transactions),
 * and a row count + unmatched chip so the operator sees "12 imported · 4
 * unmatched" at a glance.
 *
 * Empty state walks them through the first add. Phase 2 will surface
 * "Import statement" right here for one-tap data refresh.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useBankAccounts, type BankAccountRow } from "@/lib/queries/bank";
import { rupee } from "@/lib/utils";
import { AddBankAccountForm } from "@/components/features/banking/add-bank-account-form";

export default function BankingPage() {
  const router = useRouter();
  const { data: accounts, isLoading } = useBankAccounts();
  const [addOpen, setAddOpen] = React.useState(false);

  const totalBalance = (accounts ?? []).reduce(
    (sum, a) => sum + (a.current_balance ?? a.opening_balance),
    0,
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Accounting</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Banking</h1>
          <p className="text-sm text-ink-3 mt-1">
            Connect your bank accounts, import statements, and reconcile against
            customer payments + vendor expenses.
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
          Add bank account
        </Button>
      </div>

      {/* Summary strip */}
      {!isLoading && accounts && accounts.length > 0 && (
        <Card className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Total balance</p>
              <p className="font-serif text-2xl text-ink mt-1">{rupee(totalBalance, { compact: true })}</p>
              <p className="text-[11px] text-ink-3 mt-0.5">Across all accounts</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Accounts</p>
              <p className="font-serif text-2xl text-ink mt-1">{accounts.length}</p>
              <p className="text-[11px] text-ink-3 mt-0.5">Active</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Tips</p>
              <ul className="text-xs text-ink-2 space-y-1 list-disc list-inside">
                <li>Statement upload: Download last 30 days from your bank, upload CSV.</li>
                <li>Each credit gets auto-suggested matches against your payments.</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Account grid OR empty state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon="rupee"
            title="No bank accounts connected yet."
            body="Add your first bank account — HDFC, ICICI, SBI, Axis, or any Indian bank. Once added, upload a statement CSV and we'll match each transaction against your customer payments + vendor expenses."
            action={
              <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
                Add bank account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <BankAccountCard key={acc.id} account={acc} onOpen={() => router.push(`/accounting/banking/${acc.id}` as Route)} />
          ))}
        </div>
      )}

      <AddBankAccountForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

// ============================================================
// Account card
// ============================================================
function BankAccountCard({ account, onOpen }: { account: BankAccountRow; onOpen: () => void }) {
  const balance = account.current_balance ?? account.opening_balance;
  const isPositive = balance >= 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left w-full rounded-lg border border-hairline bg-paper hover:border-hairline-strong hover:shadow-md transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
            {account.bank_name}
          </p>
          <h3 className="font-semibold text-ink truncate mt-0.5">{account.name}</h3>
          <p className="text-xs text-ink-3 font-mono mt-0.5">
            ••• {account.account_number_last4} · {account.ifsc}
          </p>
        </div>
        <Badge kind="muted" size="sm">
          {account.account_type === "current" ? "Current" :
           account.account_type === "savings" ? "Savings" :
           account.account_type === "overdraft" ? "OD" :
           account.account_type === "fixed_deposit" ? "FD" : account.account_type}
        </Badge>
      </div>

      <div className="border-t border-hairline pt-3">
        <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Balance</p>
        <p className={`font-serif text-2xl mt-1 ${isPositive ? "text-ink" : "text-rose"}`}>
          {rupee(balance)}
        </p>
        <p className="text-[11px] text-ink-3 mt-1 inline-flex items-center gap-1">
          <Icon name="arrow_right" size={11} /> View transactions
        </p>
      </div>
    </button>
  );
}
