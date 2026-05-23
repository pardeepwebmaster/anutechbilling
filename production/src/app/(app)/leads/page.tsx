/**
 * Lead Pipeline — Kanban matching prototype design.
 *
 * Layout (from prototype/screens/leads.jsx):
 *   - Header: eyebrow "Sales" + title + subtitle with counts
 *   - Actions: inline search + Filter + Import CSV + Add Lead
 *   - GeminiCard with AI lead intelligence
 *   - Kanban: 6 columns (LEAD_STAGES) with header (dot + label + count + value)
 *   - Each card: company name + owner avatar / seats · plan / value | age
 *   - "Add lead" affordance at bottom of each column
 *   - Help text at bottom
 *   - Detail Sheet on card click
 */
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLeads, useUpdateLeadStage, useDeleteLead } from "@/lib/queries/leads";
import { useQuotesByLead } from "@/lib/queries/quotes";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { LeadCard } from "@/components/features/leads/lead-card";
import { AddLeadForm } from "@/components/features/leads/add-lead-form";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { rupee, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/supabase/database.types";

// ============================================================
// Stage config (matches prototype LEAD_STAGES)
// ============================================================
const LEAD_STAGES: { id: Lead["stage"]; label: string; dot: string }[] = [
  { id: "new",     label: "New",          dot: "bg-slate" },
  { id: "contact", label: "Contacted",    dot: "bg-amber" },
  { id: "demo",    label: "Demo Done",    dot: "bg-indigo" },
  { id: "trial",   label: "Trial Active", dot: "bg-rose" },
  { id: "quote",   label: "Quote Sent",   dot: "bg-indigo" },
  { id: "won",     label: "Won",          dot: "bg-emerald" },
];

export default function LeadsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const focusLeadId  = searchParams.get("lead");

  const { data: leads, isLoading, error, refetch } = useLeads();
  const updateStage = useUpdateLeadStage();

  const [search, setSearch] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<Lead["stage"] | null>(null);
  const [addOpen, setAddOpen]   = React.useState(false);
  const [selected, setSelected] = React.useState<Lead | null>(null);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);

  // ── Deep-link: open the drawer for the lead in ?lead=<id> ──
  // Runs once when leads load and the URL param is present.
  const deepLinkHandledRef = React.useRef(false);
  React.useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!focusLeadId || !leads) return;

    const match = leads.find((l) => l.id === focusLeadId);
    if (!match) {
      deepLinkHandledRef.current = true;
      toast.error(`Lead ${focusLeadId} not found`);
      return;
    }
    deepLinkHandledRef.current = true;
    setSelected(match);

    // Scroll the matching card into view so the user can see where it is in the pipeline
    setTimeout(() => {
      document
        .querySelector(`[data-lead-id="${match.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);

    // Clean the param from URL so refresh doesn't re-trigger
    router.replace("/leads" as any);
  }, [focusLeadId, leads, router]);

  // Filtered leads
  const filtered = React.useMemo(() => {
    if (!leads) return [];
    if (!search.trim()) return leads;
    const s = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.company.toLowerCase().includes(s) ||
        (l.contact_name?.toLowerCase().includes(s) ?? false) ||
        (l.contact_email?.toLowerCase().includes(s) ?? false) ||
        (l.plan?.toLowerCase().includes(s) ?? false)
    );
  }, [leads, search]);

  // Aggregates
  const totalValue = filtered.reduce((s, l) => s + (l.value ?? 0), 0);
  const wonCount = filtered.filter((l) => l.stage === "won").length;
  const conversion =
    filtered.length > 0 ? Math.round((wonCount / filtered.length) * 100) : 0;

  // Drag handlers
  const handleDrop = (toStage: Lead["stage"]) => {
    if (dragId) {
      const lead = filtered.find((l) => l.id === dragId);
      if (lead && lead.stage !== toStage) {
        updateStage.mutate({ id: dragId, stage: toStage });
        const stageLabel = LEAD_STAGES.find((s) => s.id === toStage)?.label;
        toast.success(`${lead.company} → ${stageLabel}`);
      }
    }
    setDragId(null);
    setOverStage(null);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">Sales</p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Lead Pipeline</h1>
          {!isLoading && leads && (
            <p className="text-sm text-ink-3 mt-1 tabular-nums">
              <b>{filtered.length}</b> active leads ·{" "}
              <b>{rupee(totalValue, { compact: true })}</b> total pipeline ·{" "}
              <b>{conversion}%</b> conversion
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="w-56">
            <Input
              prefix={<Icon name="search" size={14} />}
              placeholder="Search leads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button icon="filter">Filter</Button>
          <Button icon="download">Import CSV</Button>
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add Lead</Button>
        </div>
      </div>

      {/* AI lead intelligence */}
      {!isLoading && leads && leads.length > 0 && (
        <div className="mb-4">
          <GeminiCard
            title="Lead intelligence · Today"
            actions={
              <>
                <Button size="sm" variant="primary" icon="phone" onClick={() => toast("Call queued")}>
                  Call top lead now
                </Button>
                <Button size="sm" icon="mail" onClick={() => toast("Nudge drafted")}>
                  Send nudge
                </Button>
              </>
            }
          >
            <b className="text-ink">{Math.min(3, filtered.filter((l) => l.stage === "quote" || l.stage === "trial").length)} hot leads worth focusing today.</b>{" "}
            Leads in <b>Quote Sent</b> or <b>Trial Active</b> have the highest conversion. Prioritize follow-ups today.
          </GeminiCard>
        </div>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="alert"
          title="Could not load leads"
          body={error.message}
          action={<Button icon="refresh" onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {LEAD_STAGES.map((s) => (
            <div key={s.id} className="bg-paper-2 border-2 border-dashed border-hairline rounded-lg p-2.5 min-h-[400px]">
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
                <span className="text-xs font-semibold">{s.label}</span>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && leads && leads.length === 0 && (
        <EmptyState
          icon="target"
          title="No leads yet"
          body="Leads will appear here when customers fill the contact form, or you can add them manually."
          action={<Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add your first lead</Button>}
          secondary={<Button icon="download">Import CSV</Button>}
        />
      )}

      {/* Kanban */}
      {!isLoading && !error && leads && leads.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 overflow-x-auto pb-4">
            {LEAD_STAGES.map((stage) => {
              const stageLeads = filtered.filter((l) => l.stage === stage.id);
              const stageValue = stageLeads.reduce((s, l) => s + (l.value ?? 0), 0);
              const isOver = overStage === stage.id;

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(stage.id);
                  }}
                  onDragLeave={() => setOverStage(null)}
                  onDrop={() => handleDrop(stage.id)}
                  className={cn(
                    "rounded-lg p-2.5 min-h-[400px] flex flex-col gap-2",
                    "transition-colors",
                    "bg-paper-2",
                    isOver
                      ? "border-2 border-solid border-amber"
                      : "border-2 border-dashed border-hairline"
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full", stage.dot)} />
                      <span className="text-xs font-semibold text-ink">{stage.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-paper-2 text-ink-3 tabular-nums">
                        {stageLeads.length}
                      </span>
                    </div>
                    <span className="font-serif text-sm text-ink-3 tabular-nums">
                      {stageValue > 0 ? rupee(stageValue, { compact: true }) : ""}
                    </span>
                  </div>

                  {/* Cards */}
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isDragging={dragId === lead.id}
                      onDragStart={setDragId}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      onClick={(l) => setSelected(l)}
                    />
                  ))}

                  {/* Add affordance */}
                  <button
                    onClick={() => setAddOpen(true)}
                    className={cn(
                      "border border-dashed border-hairline rounded-md py-2 px-2",
                      "text-xs text-ink-3 hover:text-ink hover:border-hairline-strong",
                      "flex items-center justify-center gap-1 transition-colors",
                      stageLeads.length === 0 ? "" : "mt-1"
                    )}
                  >
                    <Icon name="plus" size={12} /> Add lead
                  </button>
                </div>
              );
            })}
          </div>

          {/* Help text */}
          <div className="flex items-center gap-2 text-xs text-ink-3 mt-1">
            <Icon name="info" size={12} />
            Drag any card across columns to update stage. Activity log updates automatically.
          </div>
        </>
      )}

      {/* No results from search */}
      {!isLoading && !error && leads && leads.length > 0 && filtered.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="search"
            title="No leads match"
            body={`No results for "${search}". Try a different search term.`}
            action={<Button icon="x" onClick={() => setSearch("")}>Clear search</Button>}
            compact
          />
        </div>
      )}

      {/* Detail drawer */}
      <LeadDetailSheet
        lead={selected}
        onClose={() => setSelected(null)}
        onEdit={(l) => {
          setSelected(null);
          setEditingLead(l);
          setAddOpen(true);
        }}
      />

      {/* Add / Edit lead modal */}
      <AddLeadForm
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setEditingLead(null);
        }}
        editingLead={editingLead}
      />
    </div>
  );
}

// ============================================================
// Lead detail Sheet (slide-out drawer on card click)
// ============================================================
function LeadDetailSheet({
  lead,
  onClose,
  onEdit,
}: {
  lead: Lead | null;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
}) {
  const router      = useRouter();
  const updateStage = useUpdateLeadStage();
  const deleteLead  = useDeleteLead();
  const { data: currentUser } = useCurrentUser();

  // History: every quote that's been sent to this lead
  const { data: quotesForLead = [] } = useQuotesByLead(lead?.id);

  if (!lead) return null;
  const hasQuotes = quotesForLead.length > 0;

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Permanently delete lead "${lead.company}"?\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;
    deleteLead.mutate(lead.id, {
      onSuccess: () => onClose(),
    });
  };

  const handleSendQuote = () => {
    // Pass lead context to QuoteBuilder via URL params
    const params = new URLSearchParams();
    params.set("leadId",  lead.id);
    params.set("company", lead.company);
    if (lead.plan)            params.set("plan",  lead.plan);
    if (lead.seats != null)   params.set("seats", String(lead.seats));
    if (lead.contact_name)    params.set("contact", lead.contact_name);
    if (lead.contact_email)   params.set("email", lead.contact_email);
    if (lead.contact_phone)   params.set("phone", lead.contact_phone);
    onClose();
    router.push(`/quotes/new?${params.toString()}` as any);
  };

  // If lead already has a quote, default the primary CTA to "Revise & resend"
  // (duplicate the latest quote, edit, resend). This avoids accidental duplicates
  // and keeps audit history clean.
  const latestQuote = quotesForLead[0]; // sorted by created_date desc
  const handleReviseQuote = () => {
    if (!latestQuote) return handleSendQuote();
    const params = new URLSearchParams();
    params.set("duplicate", latestQuote.id);
    params.set("leadId",    lead.id);
    params.set("company",   lead.company);
    if (lead.contact_name)  params.set("contact", lead.contact_name);
    if (lead.contact_email) params.set("email",   lead.contact_email);
    if (lead.contact_phone) params.set("phone",   lead.contact_phone);
    onClose();
    router.push(`/quotes/new?${params.toString()}` as any);
  };

  const handleEmail = () => {
    if (!lead.contact_email) {
      toast.error("No email on this lead");
      return;
    }
    const subject = `About your inquiry · ${lead.company}`;
    const signoff = currentUser?.tenantName ?? "your team";
    const body    = `Hi ${lead.contact_name ?? "there"},\n\nThanks for your interest in ${lead.plan ?? "our services"}. Let me know a good time to connect.\n\n— ${signoff}`;
    window.location.href = `mailto:${lead.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleArchive = () => {
    updateStage.mutate({ id: lead.id, stage: "lost" });
    toast.success(`${lead.company} archived`);
    onClose();
  };

  const stageLabel = LEAD_STAGES.find((s) => s.id === lead.stage)?.label ?? lead.stage;

  return (
    <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" hideClose>
        <SheetHeader className="!p-5 flex flex-row items-start justify-between gap-3 border-b border-hairline">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Lead detail</p>
            <SheetTitle className="text-xl mt-1">{lead.company}</SheetTitle>
            <SheetDescription className="text-xs mt-1">
              {lead.id} · Stage: <b className="text-ink">{stageLabel}</b>
            </SheetDescription>
          </div>
          <IconButton icon="x" aria-label="Close" onClick={onClose} />
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Grid of facts */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact label="Plan" value={lead.plan} />
            <Fact label="Seats" value={lead.seats?.toString()} mono />
            <Fact label="Deal value" value={lead.value ? rupee(lead.value) : "—"} big />
            <Fact label="Source" value={lead.source} mono />
            <Fact label="Contact name" value={lead.contact_name} />
            <Fact label="Email" value={lead.contact_email} mono />
            <Fact label="Phone" value={lead.contact_phone} mono />
            <Fact label="Created" value={formatDate(lead.created_at)} />
          </div>

          {/* Notes */}
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1.5">Notes</div>
            <div className="text-sm text-ink-2 whitespace-pre-wrap p-3 bg-paper-2 rounded-md min-h-[80px]">
              {lead.notes || <span className="italic text-ink-3">No notes yet.</span>}
            </div>
          </div>

          {/* ── Quotes history (only when this lead has received at least one quote) ── */}
          {hasQuotes && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  Quotes sent ({quotesForLead.length})
                </div>
              </div>
              <div className="rounded-md border border-hairline divide-y divide-hairline overflow-hidden">
                {quotesForLead.map((q) => {
                  const statusKind: "muted" | "warning" | "success" | "info" | "danger" =
                    q.status === "draft"    ? "muted" :
                    q.status === "sent"     ? "warning" :
                    q.status === "viewed"   ? "info" :
                    q.status === "accepted" ? "success" :
                    "danger";
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/quotes/${q.id}` as any);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-paper-2 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-ink truncate">
                            {q.id}
                          </span>
                          <Badge kind={statusKind} dot>{q.status}</Badge>
                        </div>
                        <div className="text-[11px] text-ink-3 mt-0.5">
                          {formatDate(q.created_at)} · {q.line_items && Array.isArray(q.line_items) ? q.line_items.length : 0} item
                          {Array.isArray(q.line_items) && q.line_items.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-serif text-sm tabular-nums text-ink">
                          {rupee(q.amount ?? 0)}
                        </div>
                        <Icon name="arrow_right" size={11} className="text-ink-3 ml-auto" />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-3 mt-1.5 flex items-center gap-1">
                <Icon name="info" size={11} />
                {lead.stage === "won"
                  ? "Click any quote to view · upsell with a new quote below"
                  : lead.stage === "lost"
                  ? "Click any quote to view · re-engage with a fresh quote below"
                  : "Click any quote to view · or send a revised quote below"}
              </p>
            </div>
          )}

          {/* Quick stage change */}
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-2">Move to stage</div>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id !== lead.stage) {
                      updateStage.mutate({ id: lead.id, stage: s.id });
                      toast.success(`${lead.company} → ${s.label}`);
                      onClose();
                    }
                  }}
                  disabled={s.id === lead.stage}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    s.id === lead.stage
                      ? "bg-amber-soft border-amber text-amber-ink font-medium cursor-default"
                      : "border-hairline text-ink-2 hover:bg-paper-2"
                  )}
                >
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", s.dot)} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="!p-4 border-t border-hairline !flex-col !items-stretch gap-2">
          {/* Secondary row — edit / archive / delete */}
          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                icon="edit"
                onClick={() => onEdit(lead)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleArchive}
              >
                Archive
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={handleDelete}
              loading={deleteLead.isPending}
              className="!text-rose hover:!bg-rose/10"
            >
              Delete
            </Button>
          </div>

          {/* Primary row — communication actions
              Stage-aware so the primary CTA always reflects the actual next
              step a sales person would take with this lead. */}
          <div className="flex justify-end gap-2 pt-2 border-t border-hairline flex-wrap">
            <Button icon="mail" onClick={handleEmail}>Email</Button>

            {lead.stage === "won" ? (
              <>
                {/* Deal done — money flowed, customer record was auto-created
                    during record_payment. Natural next moves are upsell (a
                    fresh quote tied back to this lead) or open the customer
                    record / accepted quote for context. */}
                <Button icon="send" onClick={handleSendQuote}>
                  Upsell · New quote
                </Button>
                {latestQuote && (
                  <Button
                    variant="primary"
                    icon="receipt"
                    onClick={() => {
                      onClose();
                      router.push(`/quotes/${latestQuote.id}` as any);
                    }}
                  >
                    Open accepted quote
                  </Button>
                )}
              </>
            ) : lead.stage === "lost" ? (
              <>
                {/* Deal lost — only sensible action is to re-engage with a
                    fresh quote (potentially with different pricing). The
                    earlier "revise" of a rejected quote rarely lands. */}
                <Button variant="primary" icon="send" onClick={handleSendQuote}>
                  Re-engage · Send new quote
                </Button>
              </>
            ) : hasQuotes ? (
              <>
                <Button icon="send" onClick={handleSendQuote}>
                  New quote
                </Button>
                <Button variant="primary" icon="copy" onClick={handleReviseQuote}>
                  Revise & resend
                </Button>
              </>
            ) : (
              <Button variant="primary" icon="send" onClick={handleSendQuote}>
                Send Quote
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Fact row helper for detail drawer
// ============================================================
function Fact({ label, value, mono, big }: { label: string; value: string | null | undefined; mono?: boolean; big?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-3 mb-0.5">{label}</div>
      <div className={cn(
        "text-ink",
        mono && "font-mono",
        big && "font-serif text-xl",
        !value && "italic text-ink-3 text-sm"
      )}>
        {value || "—"}
      </div>
    </div>
  );
}
