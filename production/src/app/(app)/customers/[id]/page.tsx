/**
 * Customer 360 — full detail page, "answers-first" (same blueprint as the
 * master-detail CustomerPanel, composed from the shared customer-insights
 * building blocks so the two surfaces never drift).
 *
 * Removed the old fake data: stub "Customer added" activity, hardcoded
 * "Account manager: Pardeep Sharma", and dead Note/Log-call/New-activity
 * buttons. Everything here is now derived from real rows (compass: no
 * fabricated numbers, no fake timeline).
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { useCustomer, useDeleteCustomer, useSetCustomerActive, useCustomerOpenCredit, customerDeleteBlockReason } from "@/lib/queries/customers";
import { useCustomerGroups } from "@/lib/queries/customer-groups";
import { useCustomerSubscriptions } from "@/lib/queries/subscriptions";
import { useCustomerInvoices, useCustomerQuotes } from "@/lib/queries/invoices";
import { usePayments } from "@/lib/queries/payments";
import { useCustomerProjects } from "@/lib/queries/projects";
import { CreateProjectQuoteDialog } from "@/components/features/projects/create-project-quote-dialog";
import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { TabBar } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icon";
import { formatDate, rupee, daysBetween, cn } from "@/lib/utils";
import {
  deriveCustomerInsights,
  CustomerMetricBar,
  NextBestActionCard,
  SubscriptionList,
  CustomerActivity,
  CustomerIdentityRail,
} from "@/components/features/customers/customer-insights";
import { AddReferralDialog } from "@/components/features/referrals/add-referral-dialog";
import { useReferralAgreements } from "@/lib/queries/referral-partners";
import { InvoiceChooserDialog } from "@/components/features/invoices/invoice-chooser-dialog";
import { useConfirm } from "@/components/providers/confirm-provider";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();

  const { data: customer, isLoading, error } = useCustomer(params.id);
  const { data: allGroups } = useCustomerGroups();
  const { data: subs }     = useCustomerSubscriptions(params.id);
  const { data: invoices } = useCustomerInvoices(params.id);
  const { data: quotes }   = useCustomerQuotes(params.id);
  const { data: projects } = useCustomerProjects(params.id);
  const { data: openCredit } = useCustomerOpenCredit(params.id);
  const { data: allPayments } = usePayments();

  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = React.useState<"overview" | "transactions" | "statement">("overview");
  // Segment filter inside the Transactions tab so quotes / invoices / payments
  // can each be viewed on their own (not just the combined feed).
  const [txnFilter, setTxnFilter] = React.useState<"all" | "invoices" | "quotes" | "payments" | "projects">("all");
  const [svcView, setSvcView] = React.useState<"subscription" | "project">("subscription");
  const [projQuoteOpen, setProjQuoteOpen] = React.useState(false);
  const [referralOpen, setReferralOpen] = React.useState(false);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [projInvoiceOpen, setProjInvoiceOpen] = React.useState(false);
  const { data: agreements } = useReferralAgreements(params.id);
  const deleteCustomer = useDeleteCustomer();
  const setActive = useSetCustomerActive();

  // Deep-link: /customers/[id]?edit=1 sends straight to the full-page edit form
  // (used by the "Complete customer" nudge on a project with missing GST info).
  const editParamHandled = React.useRef(false);
  React.useEffect(() => {
    if (editParamHandled.current) return;
    if (searchParams.get("edit") === "1") {
      editParamHandled.current = true;
      router.replace(`/customers/${params.id}/edit` as never);
    }
  }, [searchParams, router, params.id]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 max-w-[1240px] mx-auto">
        <EmptyState
          icon="alert"
          title={error ? "Could not load customer" : "Customer not found"}
          body={error?.message ?? "This customer does not exist in your tenant."}
          action={
            <Button asChild variant="primary" icon="users">
              <Link href={"/customers" as any}>Back to customers</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const c = customer;
  const allSubs = subs ?? [];
  const allInvoices = invoices ?? [];
  const allQuotes = quotes ?? [];
  const allProjects = projects ?? [];
  const insights = deriveCustomerInsights(c, allSubs, allInvoices, allProjects, allQuotes);
  const customerPayments = (allPayments ?? []).filter((p) => p.customer_id === c.id);

  // Unified transactions feed (Zoho "Transactions" tab) — every money record.
  const txns = [
    ...allInvoices.map((i) => ({ date: i.invoice_date, type: "Invoice" as const, ref: i.id, amount: i.amount, status: i.status, onClick: undefined as (() => void) | undefined })),
    ...customerPayments.map((p) => ({ date: p.status === "refunded" ? (p.refunded_at ?? p.received_at) : p.received_at, type: p.status === "refunded" ? ("Refund" as const) : ("Payment" as const), ref: p.receipt_voucher_no ?? p.id, amount: p.amount, status: p.status, onClick: undefined as (() => void) | undefined })),
    ...allQuotes.map((q) => ({ date: q.created_date, type: "Quote" as const, ref: q.id, amount: q.amount, status: q.status, onClick: () => router.push(`/quotes/${q.id}` as never) })),
    ...allProjects.map((p) => ({ date: p.created_at, type: "Project" as const, ref: p.title, amount: p.total_amount, status: p.status, onClick: () => router.push(`/projects/${p.id}` as never) })),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  // Running-balance ledger (Zoho "Statement" tab). Invoice = debit (owed),
  // payment = credit; positive closing balance = receivable still owed.
  const ledgerRaw = [
    ...allInvoices.map((i) => ({ date: i.invoice_date, desc: `Invoice ${i.id}`, debit: i.amount, credit: 0 })),
    ...customerPayments.filter((p) => p.status === "received").map((p) => ({ date: p.received_at, desc: `Payment received${p.receipt_voucher_no ? ` · ${p.receipt_voucher_no}` : ""}`, debit: 0, credit: p.amount })),
    ...customerPayments.filter((p) => p.status === "refunded").map((p) => ({ date: p.refunded_at ?? p.received_at, desc: `Refund${p.receipt_voucher_no ? ` · ${p.receipt_voucher_no}` : ""}`, debit: p.amount, credit: 0 })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  let runningBal = 0;
  const ledger = ledgerRaw.map((e) => { runningBal += e.debit - e.credit; return { ...e, balance: runningBal }; });
  const closingBalance = runningBal;

  // Guarded delete — Zoho-Books parity: a customer can be hard-deleted ONLY when
  // it is truly empty (no subscriptions, payments, invoices, quotes, or projects).
  // The delete_customer RPC (0174) is the authority; this client twin explains the
  // block. The Delete button stays CLICKABLE (a disabled button + hover tooltip is
  // invisible on touch/embeds) — on click it shows a clear dialog offering Archive.
  const deleteBlock = customerDeleteBlockReason({
    subscriptions: allSubs.length,
    payments: customerPayments.length,
    invoices: allInvoices.length,
    quotes: allQuotes.length,
    projects: allProjects.length,
  });
  const handleDelete = async () => {
    if (deleteBlock) {
      // Has documents → can't hard-delete. Explain why, and offer Archive (unless
      // it's already archived, in which case just acknowledge).
      const alreadyArchived = c.is_active === false;
      const archived = await confirm({
        title: `Can't delete "${c.name}"`,
        body: deleteBlock,
        confirmLabel: alreadyArchived ? "OK" : "Archive instead",
        icon: "inbox",
      });
      if (archived && !alreadyArchived) {
        setActive.mutate({ id: c.id, isActive: false });
      }
      return;
    }
    if (await confirm({ title: `Permanently delete customer "${c.name}"?`, body: "This cannot be undone.", confirmLabel: "Delete", danger: true })) {
      deleteCustomer.mutate(c.id, { onSuccess: () => router.push("/customers" as never) });
    }
  };

  const tenureDays = daysBetween(c.since, new Date());
  const tenure =
    tenureDays >= 365 ? `${Math.floor(tenureDays / 365)}y ${Math.floor((tenureDays % 365) / 30)}mo`
    : tenureDays >= 30 ? `${Math.floor(tenureDays / 30)}mo`
    : `${Math.max(tenureDays, 0)}d`;

  const TXN_BADGE: Record<string, "info" | "success" | "danger" | "muted" | "warning"> = {
    Invoice: "info", Payment: "success", Refund: "danger", Quote: "muted", Project: "warning",
  };

  // Transactions segment filter — view invoices / quotes / payments separately.
  const txnInFilter = (type: string) =>
    txnFilter === "all" ? true
    : txnFilter === "invoices" ? type === "Invoice"
    : txnFilter === "quotes"   ? type === "Quote"
    : txnFilter === "payments" ? (type === "Payment" || type === "Refund")
    : txnFilter === "projects" ? type === "Project"
    : true;
  const txnSegments = [
    { id: "all" as const,      label: "All",      n: txns.length },
    { id: "invoices" as const, label: "Invoices", n: txns.filter((t) => t.type === "Invoice").length },
    { id: "quotes" as const,   label: "Quotes",   n: txns.filter((t) => t.type === "Quote").length },
    { id: "payments" as const, label: "Payments", n: txns.filter((t) => t.type === "Payment" || t.type === "Refund").length },
    { id: "projects" as const, label: "Projects", n: txns.filter((t) => t.type === "Project").length },
  ].filter((s) => s.id === "all" || s.n > 0);
  const filteredTxns = txns.filter((t) => txnInFilter(t.type));

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto">
      {/* Header — identity + real contact actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <IconButton icon="arrow_left" aria-label="Back" onClick={() => router.push("/customers" as any)} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">
              Customer · since {formatDate(c.since)} · {tenure}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">{c.display_name || c.name}</h1>
            {(c.contact_name || c.domain) && (
              <p className="mt-1 text-sm text-ink-3">
                {c.contact_name}{c.contact_name && c.contact_title ? ` · ${c.contact_title}` : ""}
                {c.contact_name && c.domain ? "  ·  " : ""}
                {c.domain && <span className="font-mono text-xs">{c.domain}</span>}
              </p>
            )}
            {c.group_id && (() => {
              const g = (allGroups ?? []).find((x) => x.id === c.group_id);
              return g ? (
                <Link href={`/customers/groups/${g.id}` as never} className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber hover:underline">
                  <Icon name="layout" size={12} /> Part of group: {g.name}
                </Link>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button icon="award" onClick={() => setReferralOpen(true)}>
            {(agreements ?? []).some((a) => a.status === "active") ? "Referral ✓" : "Add referral"}
          </Button>
          <Button icon="edit" onClick={() => router.push(`/customers/${c.id}/edit` as never)}>Edit</Button>
          <Button icon="receipt" onClick={() => setInvoiceOpen(true)}>Invoice</Button>
          <Button variant="primary" icon="plus" onClick={() => router.push(`/quotes/new?customer=${c.id}` as any)}>New quote</Button>
          {/* Archive / reactivate — the money-safe alternative to delete. Works
              even when the customer has invoices/payments (records are kept). */}
          <Button
            icon="inbox"
            variant="ghost"
            loading={setActive.isPending}
            onClick={async () => {
              const next = c.is_active === false;
              if (next || (await confirm({ title: `Archive "${c.name}"?`, body: "They'll be hidden from your active customers (all invoices/payments are kept). You can reactivate anytime.", confirmLabel: "Archive", icon: "inbox" }))) {
                setActive.mutate({ id: c.id, isActive: next });
              }
            }}
            title={c.is_active === false ? "Reactivate this customer" : "Archive (hide from active list)"}
          >
            {c.is_active === false ? "Reactivate" : "Archive"}
          </Button>
          <Button
            icon="trash"
            variant="ghost"
            onClick={handleDelete}
            loading={deleteCustomer.isPending}
            title={deleteBlock ? "This customer has documents — click to see options" : "Delete this customer"}
            className="!text-rose hover:!bg-rose/10"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Top tabs — Zoho-style customer 360 */}
      <TabBar
        value={mainTab}
        onChange={(v) => setMainTab(v as "overview" | "transactions" | "statement")}
        items={[
          { id: "overview",     label: "Overview" },
          { id: "transactions", label: "Transactions", count: txns.length || undefined },
          { id: "statement",    label: "Statement" },
        ]}
        className="mb-5 overflow-y-hidden"
      />

      {mainTab === "overview" && (
      <>
      {/* Answer-bar */}
      <div className="mb-4">
        <CustomerMetricBar insights={insights} />
      </div>

      {/* Advance credit held (from an earlier overpayment) — adjustable against the next bill */}
      {(openCredit ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald/30 bg-emerald-soft/40 px-3 py-2 text-sm">
          <Icon name="rupee" size={15} className="text-emerald flex-shrink-0" />
          <span className="text-ink">
            <b>{rupee(openCredit ?? 0)}</b> advance credit — will be offered to adjust against this customer's next payment.
          </span>
        </div>
      )}

      {/* Next-best-action */}
      <div className="mb-6">
        <NextBestActionCard nba={insights.nba} customer={c} />
      </div>

      {/* Body — identity rail (Zoho-style) on the left, money + activity on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-5">
        {/* LEFT — who / where / tax + billing details */}
        <CustomerIdentityRail c={c} />

        {/* RIGHT — subscriptions + activity */}
        <div className="space-y-4 min-w-0">
          <Card
            title="Subscriptions & projects"
            sub={svcView === "subscription"
              ? (allSubs.length > 0 ? `${insights.activeSubs.length} active` : undefined)
              : ((projects ?? []).length > 0 ? `${(projects ?? []).length} project${(projects ?? []).length > 1 ? "s" : ""}` : undefined)}
            actions={
              <Button
                size="sm"
                variant="primary"
                icon="plus"
                onClick={() =>
                  svcView === "project"
                    ? setProjQuoteOpen(true)
                    : router.push(`/quotes/new?customer=${c.id}` as any)
                }
              >
                {svcView === "project" ? "New project quote" : "New subscription"}
              </Button>
            }
          >
            <div className="mb-3">
              <TabBar
                value={svcView}
                onChange={(v) => setSvcView(v as "subscription" | "project")}
                items={[
                  { id: "subscription", label: "Subscription", count: allSubs.length || undefined },
                  { id: "project",      label: "Project",      count: (projects ?? []).length || undefined },
                ]}
              />
            </div>

            {svcView === "subscription" && <SubscriptionList subs={allSubs} />}

            {svcView === "project" && (
              (projects ?? []).length > 0 ? (
                <RecordTable
                  head={["Project", "Total (incl GST)", "Outstanding", "Status", "Created"]}
                  rows={(projects ?? []).map((p) => ({
                    onClick: () => router.push(`/projects/${p.id}` as any),
                    cells: [
                      <span key="t" className="font-medium">{p.title}</span>,
                      <span key="tot" className="tabular-nums font-medium">{rupee(p.total_amount)}</span>,
                      <span key="out" className={`tabular-nums ${p.receivable > 0 ? "text-rose" : "text-emerald"}`}>{rupee(p.receivable)}</span>,
                      <Badge key="b" kind={p.status === "completed" ? "success" : p.status === "cancelled" ? "muted" : p.status === "quoted" ? "info" : "warning"} dot>
                        {p.status === "quoted" ? "Quotation" : p.status}
                      </Badge>,
                      formatDate(p.created_at),
                    ],
                  }))}
                />
              ) : (
                <p className="text-sm text-ink-3 py-6 text-center">No projects for this customer yet.</p>
              )
            )}
          </Card>

          <Card title="Recent activity">
            <CustomerActivity subs={allSubs} invoices={allInvoices} quotes={allQuotes} limit={12} />
          </Card>
        </div>
      </div>
      </>
      )}

      {/* ─────────── Transactions — every money record ─────────── */}
      {mainTab === "transactions" && (
        <Card flush>
          <div className="p-4">
            {txns.length > 0 ? (
              <>
                {/* Segment filter — invoices / quotes / payments each on their own. */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {txnSegments.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={txnFilter === s.id}
                      onClick={() => setTxnFilter(s.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber",
                        txnFilter === s.id
                          ? "border-amber bg-amber-soft text-amber-ink"
                          : "border-hairline text-ink-3 hover:text-ink hover:bg-paper-2",
                      )}
                    >
                      {s.label}
                      <span className={cn("tabular-nums", txnFilter === s.id ? "text-amber-ink" : "text-ink-3")}>{s.n}</span>
                    </button>
                  ))}
                </div>
                {filteredTxns.length > 0 ? (
                  <RecordTable
                    head={["Date", "Type", "Reference", "Amount", "Status"]}
                    rows={filteredTxns.map((t) => ({
                      onClick: t.onClick,
                      cells: [
                        formatDate(t.date),
                        <Badge key="ty" kind={TXN_BADGE[t.type]} dot>{t.type}</Badge>,
                        <span key="r" className="font-mono text-xs">{t.ref}</span>,
                        <span key="a" className="tabular-nums font-medium">{rupee(t.amount)}</span>,
                        <span key="s" className="text-ink-2 capitalize">{t.status}</span>,
                      ],
                    }))}
                  />
                ) : (
                  <EmptyState icon="receipt" title="Nothing here" body="No records of this type for this customer." compact />
                )}
              </>
            ) : (
              <EmptyState icon="receipt" title="No transactions yet" body="Quotes, invoices and payments for this customer will appear here." compact />
            )}
          </div>
        </Card>
      )}

      {/* ─────────── Statement — running-balance ledger ─────────── */}
      {mainTab === "statement" && (
        <Card flush>
          <div className="p-4">
            {ledger.length > 0 ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-ink-3">Account statement — invoices billed vs payments received.</p>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Closing balance</div>
                    <div className={cn("font-serif text-xl tabular-nums", closingBalance > 0 ? "text-rose" : "text-emerald")}>
                      {closingBalance > 0 ? `${rupee(closingBalance)} owed` : closingBalance < 0 ? `${rupee(-closingBalance)} credit` : rupee(0)}
                    </div>
                  </div>
                </div>
                <RecordTable
                  head={["Date", "Details", "Debit", "Credit", "Balance"]}
                  rows={ledger.map((e) => ({
                    cells: [
                      formatDate(e.date),
                      e.desc,
                      <span key="d" className="tabular-nums text-ink-2">{e.debit ? rupee(e.debit) : "—"}</span>,
                      <span key="cr" className="tabular-nums text-emerald">{e.credit ? rupee(e.credit) : "—"}</span>,
                      <span key="b" className="tabular-nums font-medium">{rupee(e.balance)}</span>,
                    ],
                  }))}
                />
              </>
            ) : (
              <EmptyState icon="file" title="No statement yet" body="Once this customer has invoices and payments, a running statement appears here." compact />
            )}
          </div>
        </Card>
      )}

      <CreateProjectQuoteDialog open={projQuoteOpen} onOpenChange={setProjQuoteOpen} prefillCustomerId={c.id} />
      <AddReferralDialog open={referralOpen} onOpenChange={setReferralOpen} customerId={c.id} customerName={c.name} />
      <InvoiceChooserDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} customerId={c.id} onChooseProject={() => setProjInvoiceOpen(true)} />
      <CreateProjectQuoteDialog open={projInvoiceOpen} onOpenChange={setProjInvoiceOpen} mode="invoice" prefillCustomerId={c.id} />
    </div>
  );
}

// Clickable record table for the Quotes / Invoices tabs.
function RecordTable({ head, rows }: { head: string[]; rows: { cells: React.ReactNode[]; onClick?: () => void }[] }) {
  return (
    <>
      {/* Mobile: each row as a stacked label→value card (table side-scrolls on
          phones, §20). Uses the column heads as labels so it stays generic. */}
      <ul className="md:hidden space-y-2">
        {rows.map((r, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={r.onClick}
              className={cn(
                "w-full text-left rounded-md border border-hairline bg-paper p-3 space-y-1.5",
                r.onClick ? "cursor-pointer hover:bg-paper-2/40" : "cursor-default",
              )}
            >
              {r.cells.map((cell, j) => (
                <div key={j} className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-wider text-ink-3 shrink-0">{head[j]}</span>
                  <span className="text-sm text-ink-2 text-right min-w-0">{cell}</span>
                </div>
              ))}
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop / tablet table */}
      <div className="hidden md:block border border-hairline rounded-md overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper-2/50">
            <tr>
              {head.map((h) => (
                <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-ink-3 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r, i) => (
              <tr
                key={i}
                onClick={r.onClick}
                className={cn("hover:bg-paper-2/30", r.onClick && "cursor-pointer")}
              >
                {r.cells.map((cell, j) => <td key={j} className="px-3 py-2 text-ink-2 whitespace-nowrap">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
