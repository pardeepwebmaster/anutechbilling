/**
 * ReconcileTransactionDialog — match a bank transaction to an internal record.
 *
 * Opens as a side drawer when the operator clicks "Reconcile" on a row in
 * the bank account detail page. The body has two parts:
 *
 *   1. The transaction header: date, description, amount + reference, so
 *      the operator can confirm at a glance which line they're reconciling.
 *   2. A list of server-suggested matches (payments / expenses near in
 *      amount + date) — one click on "Match" links the two and closes.
 *
 * If none of the suggestions are right, the operator can pick "Mark as
 * reconciled (no internal match)" — used for bank charges, interest
 * income, owner's-own transfers between accounts. Future Phase 2: typeahead
 * search across all payments/expenses for the rare case where amount /
 * date drift more than ±₹100 / ±7 days from any candidate.
 */
"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSuggestMatches,
  useReconcileTransaction,
  type BankTransactionRow,
  type MatchSuggestion,
} from "@/lib/queries/bank";
import { rupee, formatDate } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransactionRow | null;
}

export function ReconcileTransactionDialog({ open, onOpenChange, transaction }: Props) {
  const { data: suggestions, isLoading: sugLoading } = useSuggestMatches(transaction?.id ?? null);
  const reconcile = useReconcileTransaction();

  const handleMatch = async (s: MatchSuggestion) => {
    if (!transaction) return;
    try {
      await reconcile.mutateAsync({
        transactionId: transaction.id,
        matchedToType: s.match_type,
        matchedToId:   s.match_id,
        confidence:    s.match_confidence,
      });
      onOpenChange(false);
    } catch {
      /* hook toasts the error */
    }
  };

  const handleManualReconcile = async () => {
    if (!transaction) return;
    try {
      await reconcile.mutateAsync({
        transactionId: transaction.id,
        matchedToType: "manual",
        matchedToId:   null,
        confidence:    "manual",
      });
      onOpenChange(false);
    } catch {
      /* hook toasts the error */
    }
  };

  // Direction + amount hint
  const isCredit = (transaction?.credit ?? 0) > 0;
  const amount   = isCredit ? transaction?.credit ?? 0 : transaction?.debit ?? 0;
  const dirIcon  = isCredit ? "arrow_left" : "arrow_right";
  const dirLabel = isCredit ? "Money in"   : "Money out";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] md:max-w-[560px] p-0 flex flex-col overflow-x-hidden"
      >
        <SheetHeader>
          <SheetTitle>Reconcile transaction</SheetTitle>
          <SheetDescription>
            Match this bank line to a customer payment, vendor expense, or
            mark it reconciled manually (e.g., bank charges).
          </SheetDescription>
        </SheetHeader>

        {!transaction ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {/* Transaction summary card */}
            <div className="rounded-md border border-hairline bg-paper-2/40 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold inline-flex items-center gap-1">
                    <Icon name={dirIcon} size={10} /> {dirLabel}
                  </p>
                  <p className="text-sm text-ink mt-0.5 break-words">
                    {transaction.description}
                  </p>
                  {transaction.reference && (
                    <p className="text-[11px] text-ink-3 font-mono mt-1">
                      Ref: {transaction.reference}
                    </p>
                  )}
                  <p className="text-[11px] text-ink-3 mt-1">
                    {formatDate(transaction.txn_date)}
                  </p>
                </div>
                <p className={`font-serif text-xl tabular-nums whitespace-nowrap ${isCredit ? "text-emerald" : "text-rose"}`}>
                  {isCredit ? "+" : "−"}{rupee(amount)}
                </p>
              </div>
            </div>

            {/* Suggested matches */}
            <div>
              <p className="text-xs font-semibold text-ink-2 mb-2">
                Suggested matches
              </p>

              {sugLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : !suggestions || suggestions.length === 0 ? (
                <div className="rounded-md border border-dashed border-hairline bg-paper-2/20 px-4 py-6 text-center">
                  <Icon name="info" size={18} className="text-ink-3 mx-auto mb-1" />
                  <p className="text-sm text-ink-2">No close matches found</p>
                  <p className="text-[11px] text-ink-3 mt-1">
                    We looked for {isCredit ? "payments" : "expenses"} within ±₹100 and
                    ±7 days. Use &ldquo;Mark reconciled manually&rdquo; below for bank
                    charges, interest, or owner transfers.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {suggestions.map((s) => (
                    <li
                      key={`${s.match_type}-${s.match_id}`}
                      className="rounded-md border border-hairline bg-paper hover:border-hairline-strong transition-colors p-3 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge
                            kind={s.match_type === "payment" ? "success" : "muted"}
                            size="sm"
                          >
                            {s.match_type === "payment" ? "Payment" : "Expense"}
                          </Badge>
                          <ConfidencePill confidence={s.match_confidence} />
                        </div>
                        <p className="text-sm font-medium text-ink truncate">
                          {s.match_label}
                        </p>
                        <p className="text-[11px] text-ink-3">
                          {rupee(s.match_amount)} · {formatDate(s.match_date)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleMatch(s)}
                        disabled={reconcile.isPending}
                      >
                        Match
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Manual reconcile escape hatch */}
            <div className="rounded-md border border-hairline bg-paper-2/30 p-3">
              <p className="text-xs font-semibold text-ink-2 mb-1">
                None of these match?
              </p>
              <p className="text-[11px] text-ink-3 mb-3 leading-relaxed">
                Mark this reconciled without linking it to a customer payment
                or vendor expense. Useful for bank charges, interest income,
                or transfers between your own accounts.
              </p>
              <Button
                size="sm"
                variant="default"
                icon="check_circle"
                onClick={handleManualReconcile}
                disabled={reconcile.isPending}
              >
                Mark reconciled manually
              </Button>
            </div>
          </div>
        )}

        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Helpers
// ============================================================
function ConfidencePill({ confidence }: { confidence: MatchSuggestion["match_confidence"] }) {
  if (confidence === "exact") {
    return <Badge kind="success" size="sm" dot>Exact</Badge>;
  }
  if (confidence === "high") {
    return <Badge kind="warning" size="sm" dot>High</Badge>;
  }
  return <Badge kind="muted" size="sm" dot>Low</Badge>;
}
