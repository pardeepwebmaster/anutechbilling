/**
 * Deal Pipeline — Kanban or list view of every active deal.
 *
 * Naming note: the entity is still `leads` in DB / queries (each row starts
 * life as a lead at the "new" stage). The PIPELINE view shows them after
 * they've acquired a value + stage — at which point they behave as deals,
 * not leads. Industry convention (HubSpot / Salesforce / Pipedrive) matches.
 *
 * Layout:
 *   - Header: eyebrow "Sales" + "Deal Pipeline" + subtitle with counts
 *   - Actions: search + view toggle (Kanban / List) + Filter + Import + Add Lead
 *   - GeminiCard with AI lead intelligence
 *   - Kanban (default): 6 columns (LEAD_STAGES) with drag-drop stage update
 *   - List (toggle): sortable table for scanning many deals at scale
 *   - Detail Sheet on card / row click
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
  // Kanban is great for stage flow; list view is needed once you have 50+ leads
  // and want to scan by value/age/owner. Persisted in localStorage so the user's
  // preferred view sticks across sessions.
  // User's preferred view for the DEALS tab. Leads tab always forces list
  // view because Kanban is a stage-flow tool and raw leads (no plan picked)
  // can only logically live in 'new' or 'contacted' — the other 4 columns
  // would always be empty and just clutter the screen.
  const [view, setView] = React.useState<"kanban" | "list">(() => {
    if (typeof window === "undefined") return "kanban";
    return (window.localStorage.getItem("leads-view") as "kanban" | "list") ?? "kanban";
  });
  React.useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("leads-view", view);
  }, [view]);
  // Sort state for the list view (kanban ignores this)
  const [sortBy, setSortBy] = React.useState<"created" | "value" | "company" | "stage" | "age">("created");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

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

  // ── Leads vs Deals split ────────────────────────────────────────────────
  // Leads = raw inquiries, no plan picked yet (NULL or empty). Awaiting
  //         qualification.
  // Deals = qualified opportunities (plan set) flowing through stages.
  // Same DB table; different filter cut so the two concepts don't mix.
  // Industry convention (HubSpot / Salesforce / Pipedrive) — direct entity
  // naming beats metaphors like "Inbox" / "Pipeline".
  const [tab, setTab] = React.useState<"leads" | "deals">("deals");

  // Search applies BEFORE the tab cut so both views respect the search box.
  const searched = React.useMemo(() => {
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

  const isRaw = (l: Lead) => !l.plan || l.plan.trim() === "";
  const rawLeads      = React.useMemo(() => searched.filter(isRaw),       [searched]);
  const qualifiedDeals = React.useMemo(() => searched.filter((l) => !isRaw(l)), [searched]);

  // The Kanban / List views consume this — points at whichever tab is active.
  const filtered = tab === "leads" ? rawLeads : qualifiedDeals;

  // Leads tab always renders as a list (Kanban makes no sense — raw leads can
  // only live in 'new' or 'contacted', so 4 of 6 columns would always be empty).
  // Deals tab respects the user's saved preference.
  const effectiveView = tab === "leads" ? "list" : view;

  // Stats are based on Deals (where value lives — raw leads have no value yet)
  const totalValue = qualifiedDeals.reduce((s, l) => s + (l.value ?? 0), 0);
  const wonCount = qualifiedDeals.filter((l) => l.stage === "won").length;
  const conversion =
    qualifiedDeals.length > 0 ? Math.round((wonCount / qualifiedDeals.length) * 100) : 0;

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
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Deal Pipeline</h1>
          {!isLoading && leads && (
            <p className="text-sm text-ink-3 mt-1 tabular-nums">
              <b>{filtered.length}</b> active deals ·{" "}
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
          {/* View toggle — Kanban for stage flow, List for scale (50+ leads).
              Hidden on the Leads tab because raw leads can only sit in 'new' /
              'contacted', making Kanban mostly empty columns. Leads tab always
              renders as a list (triage queue, not stage flow). */}
          <div className={cn(
            "inline-flex rounded-md border border-hairline overflow-hidden",
            tab === "leads" && "hidden",
          )}>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                view === "kanban" ? "bg-ink text-paper" : "bg-paper text-ink-2 hover:bg-paper-2",
              )}
              aria-pressed={view === "kanban"}
              title="Kanban view — best for stage flow"
            >
              <Icon name="layout" size={13} /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors border-l border-hairline",
                view === "list" ? "bg-ink text-paper" : "bg-paper text-ink-2 hover:bg-paper-2",
              )}
              aria-pressed={view === "list"}
              title="List view — best for scanning many leads by value/age"
            >
              <Icon name="more_h" size={13} /> List
            </button>
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

      {/* Leads / Deals tab bar — primary separation of raw inquiries vs
          qualified opportunities. Counts come from the SEARCH-FILTERED data
          so the numbers reflect what the user is currently scanning. */}
      {!isLoading && !error && leads && leads.length > 0 && (
        <div className="mb-4 flex items-center gap-1 border-b border-hairline">
          <button
            type="button"
            onClick={() => setTab("leads")}
            className={cn(
              "px-3 py-2 text-sm font-medium inline-flex items-center gap-2 transition-colors border-b-2 -mb-px",
              tab === "leads"
                ? "border-amber text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
            aria-pressed={tab === "leads"}
          >
            <Icon name="inbox" size={14} />
            Leads
            <span className={cn(
              "text-[10px] tabular-nums rounded-full px-1.5 py-0.5",
              tab === "leads" ? "bg-amber text-paper" : "bg-paper-2 text-ink-3",
            )}>
              {rawLeads.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("deals")}
            className={cn(
              "px-3 py-2 text-sm font-medium inline-flex items-center gap-2 transition-colors border-b-2 -mb-px",
              tab === "deals"
                ? "border-amber text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
            aria-pressed={tab === "deals"}
          >
            <Icon name="target" size={14} />
            Deals
            <span className={cn(
              "text-[10px] tabular-nums rounded-full px-1.5 py-0.5",
              tab === "deals" ? "bg-amber text-paper" : "bg-paper-2 text-ink-3",
            )}>
              {qualifiedDeals.length}
            </span>
          </button>
          <p className="ml-auto text-[11px] text-ink-3 pb-1">
            {tab === "leads"
              ? "Raw inquiries — no plan picked yet. Qualify to move into Deals."
              : "Qualified opportunities with plan + value, flowing through stages."}
          </p>
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

      {/* Kanban — only shows on Deals tab (raw leads in the Leads tab have
          no meaningful stage flow, so we force list view there). */}
      {!isLoading && !error && leads && leads.length > 0 && effectiveView === "kanban" && (
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

      {/* List view — sortable table, designed for scanning at 50+ leads.
          Also the only view available on the Leads tab (triage queue). */}
      {!isLoading && !error && leads && leads.length > 0 && effectiveView === "list" && (
        <LeadListView
          leads={filtered}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={(col) => {
            if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
            else { setSortBy(col); setSortDir(col === "company" ? "asc" : "desc"); }
          }}
          onRowClick={(l) => setSelected(l)}
        />
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

          {/* Quick stage change
              For a raw lead (no plan picked yet), only "new" / "contact" are
              logically valid — demo/trial/quote/won all require a plan to
              make sense. Show only the relevant chips + a hint to qualify
              first if the user wants to progress further. */}
          {(() => {
            const isRawLead = !lead.plan || lead.plan.trim() === "";
            const visibleStages = isRawLead
              ? LEAD_STAGES.filter((s) => s.id === "new" || s.id === "contact")
              : LEAD_STAGES;
            return (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-2">Move to stage</div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleStages.map((s) => (
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
                {isRawLead && (
                  <p className="text-[11px] text-ink-3 mt-2 flex items-start gap-1">
                    <Icon name="info" size={11} className="mt-0.5 flex-shrink-0" />
                    Pick a plan (Edit) to unlock <b>Demo · Trial · Quote · Won</b> stages — those require a known plan + value.
                  </p>
                )}
              </div>
            );
          })()}
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
// LeadListView — table view for scanning leads at scale (50+).
// Same data source + same row-click drawer as Kanban; just a different lens.
// ============================================================

type SortCol = "created" | "value" | "company" | "stage" | "age";

const STAGE_DOT: Record<Lead["stage"], string> = {
  new:     "bg-slate",
  contact: "bg-amber",
  demo:    "bg-indigo",
  trial:   "bg-rose",
  quote:   "bg-indigo",
  won:     "bg-emerald",
  lost:    "bg-ink-3",
};
const STAGE_LABEL: Record<Lead["stage"], string> = {
  new: "New", contact: "Contacted", demo: "Demo Done", trial: "Trial Active",
  quote: "Quote Sent", won: "Won", lost: "Lost",
};

/** Days since `updated_at`. >14 means stale. */
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function LeadListView({
  leads,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
}: {
  leads: Lead[];
  sortBy: SortCol;
  sortDir: "asc" | "desc";
  onSort: (col: SortCol) => void;
  onRowClick: (l: Lead) => void;
}) {
  // Apply sort (memo so we don't resort on every render)
  const sorted = React.useMemo(() => {
    const out = [...leads];
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      switch (sortBy) {
        case "value":   return ((a.value ?? 0) - (b.value ?? 0)) * dir;
        case "company": return a.company.localeCompare(b.company) * dir;
        case "stage":   return a.stage.localeCompare(b.stage) * dir;
        case "age":     return (daysSince(a.updated_at) - daysSince(b.updated_at)) * dir;
        case "created":
        default:        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
    });
    return out;
  }, [leads, sortBy, sortDir]);

  const SortHeader = ({ col, label, align = "left" }: { col: SortCol; label: string; align?: "left" | "right" }) => (
    <th
      onClick={() => onSort(col)}
      className={cn(
        "p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider cursor-pointer select-none hover:text-ink",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortBy === col && (
          <Icon name={sortDir === "asc" ? "chevron_up" : "chevron_down"} size={11} />
        )}
      </span>
    </th>
  );

  return (
    <div className="border border-hairline rounded-md overflow-hidden bg-paper">
      <table className="w-full">
        <thead className="bg-paper-2 border-b border-hairline">
          <tr>
            <SortHeader col="company" label="Company" />
            <th className="p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider text-left">Contact</th>
            <th className="p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider text-left">Plan</th>
            <th className="p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider text-right">Seats</th>
            <SortHeader col="value" label="Value" align="right" />
            <SortHeader col="stage" label="Stage" />
            <SortHeader col="created" label="Created" />
            <SortHeader col="age" label="Last update" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => {
            const stale = daysSince(lead.updated_at) > 14 && lead.stage !== "won" && lead.stage !== "lost";
            const age   = daysSince(lead.updated_at);
            return (
              <tr
                key={lead.id}
                data-lead-id={lead.id}
                onClick={() => onRowClick(lead)}
                className="border-b border-hairline last:border-0 hover:bg-paper-2/40 cursor-pointer transition-colors"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {stale && (
                      <span
                        className="w-2 h-2 rounded-full bg-rose shrink-0"
                        title={`Stale — no activity for ${age} days`}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{lead.company}</div>
                      <div className="text-[10px] text-ink-3 font-mono">{lead.id}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-sm">
                  <div className="text-ink">{lead.contact_name ?? "—"}</div>
                  <div className="text-[11px] text-ink-3 font-mono truncate max-w-[180px]">
                    {lead.contact_email ?? lead.contact_phone ?? ""}
                  </div>
                </td>
                <td className="p-3 text-sm text-ink-2">{lead.plan ?? "—"}</td>
                <td className="p-3 text-right tabular-nums text-sm">{lead.seats ?? "—"}</td>
                <td className="p-3 text-right tabular-nums text-sm font-medium">
                  {lead.value ? rupee(lead.value) : <span className="text-ink-3">—</span>}
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={cn("w-1.5 h-1.5 rounded-full", STAGE_DOT[lead.stage])} />
                    {STAGE_LABEL[lead.stage]}
                  </span>
                </td>
                <td className="p-3 text-sm text-ink-2">{formatDate(lead.created_at)}</td>
                <td className="p-3 text-sm">
                  <span className={cn(
                    "tabular-nums",
                    stale ? "text-rose font-medium" : "text-ink-3",
                  )}>
                    {age === 0 ? "today" : age === 1 ? "1d ago" : `${age}d ago`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="p-8 text-center text-sm text-ink-3 italic">No leads match.</div>
      )}
      <div className="px-3 py-2 border-t border-hairline bg-paper-2/40 text-[11px] text-ink-3 flex items-center gap-2">
        <Icon name="info" size={11} />
        Click any row to open the lead drawer · Red dot = stale (no activity 14+ days) · Click column headers to sort
      </div>
    </div>
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
