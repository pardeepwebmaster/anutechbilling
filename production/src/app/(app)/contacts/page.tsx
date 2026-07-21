/**
 * Contacts — unified directory of every person known to the tenant.
 * Aggregates leads + customers and lets the operator run campaigns to selected contacts.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAllContacts } from "@/lib/queries/contacts";
import ImportContactsDialog from "@/components/features/contacts/import-contacts-dialog";
import CampaignComposerDialog from "@/components/features/campaigns/campaign-composer-dialog";
import { FAB } from "@/components/ui/fab";
import { useQueryClient } from "@tanstack/react-query";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { KPI } from "@/components/shared/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, initials } from "@/lib/utils";

const SOURCE_TABS: TabBarItem[] = [
  { id: "all",      label: "All" },
  { id: "lead",     label: "From Leads",     dot: "amber"   },
  { id: "customer", label: "From Customers", dot: "emerald" },
  { id: "imported", label: "Imported",       dot: "indigo"  },
];

export default function ContactsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: contacts, isLoading, error, refetch } = useAllContacts();

  const [tab, setTab]       = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = React.useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = React.useState(false);
  const [composerRecipients, setComposerRecipients] = React.useState<{ email: string; name?: string; company?: string }[]>([]);

  // Promote a single imported contact to lead
  async function promoteOne(contactId: string) {
    try {
      const res = await fetch(`/api/contacts/${contactId}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not promote");
        return;
      }
      toast.success(`Promoted → lead ${json.leadId}`);
      qc.invalidateQueries({ queryKey: ["contacts", "all"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      router.push(`/leads?lead=${json.leadId}` as never);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  }

  // Filter
  const filtered = (contacts ?? []).filter((c) => {
    if (tab !== "all" && c.source !== tab) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (
        !c.name?.toLowerCase().includes(s) &&
        !c.email?.toLowerCase().includes(s) &&
        !c.phone?.toLowerCase().includes(s) &&
        !c.company.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  // Counts
  const counts: Record<string, number> = { all: contacts?.length ?? 0 };
  for (const c of contacts ?? []) {
    counts[c.source] = (counts[c.source] ?? 0) + 1;
  }
  const tabsWithCounts = SOURCE_TABS.map((t) => ({ ...t, count: counts[t.id] ?? 0 }));

  // Selection helpers
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  // Bulk actions — message the exact selected contacts. (The Campaigns tool is
  // stage-targeted and email-only; here the operator hand-picked people, so we
  // act on precisely those: Gmail with everyone in BCC for email, and — since
  // WhatsApp has no bulk-link — copy the numbers for a broadcast list.)
  const startCampaign = (channel: "email" | "whatsapp") => {
    const chosen = (contacts ?? []).filter((c) => selected.has(c.id));
    if (chosen.length === 0) {
      toast.error("Select at least one contact");
      return;
    }

    if (channel === "email") {
      const recips = chosen
        .filter((c) => c.email?.trim())
        .map((c) => ({ email: c.email!.trim(), name: c.name ?? undefined, company: c.company || undefined }));
      if (recips.length === 0) {
        toast.error("None of the selected contacts have an email");
        return;
      }
      setComposerRecipients(recips);
      setEmailComposerOpen(true);
      return;
    }

    // WhatsApp: no bulk-send link exists; copy the numbers for a broadcast list.
    const phones = chosen
      .map((c) => (c.phone ?? "").replace(/\D/g, ""))
      .filter((p) => p.length >= 10);
    if (phones.length === 0) {
      toast.error("None of the selected contacts have a phone number");
      return;
    }
    navigator.clipboard?.writeText(phones.join("\n")).then(
      () => toast.success(`${phones.length} number${phones.length > 1 ? "s" : ""} copied — paste into a WhatsApp broadcast list`),
      () => toast.error("Clipboard blocked — couldn't copy the numbers"),
    );
  };

  // KPIs
  const totalEmails = (contacts ?? []).filter((c) => c.email).length;
  const totalPhones = (contacts ?? []).filter((c) => c.phone).length;
  const reachablePct = (contacts?.length ?? 0) > 0
    ? Math.round((totalEmails / (contacts?.length ?? 1)) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold mb-1">
            Workspace
          </p>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">Contacts</h1>
          <p className="text-sm text-ink-3 mt-1">
            All people across leads & customers · run targeted campaigns
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="download" onClick={() => toast.info("Export coming soon")}>
            Export CSV
          </Button>
          <Button variant="primary" icon="upload" onClick={() => setImportOpen(true)}>
            Import from Google
          </Button>
        </div>
      </div>

      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} />

      {emailComposerOpen && (
        <CampaignComposerDialog
          open={emailComposerOpen}
          onOpenChange={setEmailComposerOpen}
          recipients={composerRecipients}
        />
      )}

      {/* Mobile thumb-zone action — contacts are added via import (no single-add form). */}
      <FAB icon="upload" label="Import contacts" onClick={() => setImportOpen(true)} />

      {/* KPIs */}
      {!isLoading && contacts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Total contacts" value={contacts.length} trend="all sources" />
          <KPI label="With email"     value={totalEmails}     trend={`${reachablePct}% reachable`} trendKind="up" icon="mail" />
          <KPI label="With phone"     value={totalPhones}     trend="WhatsApp reachable" icon="whatsapp" />
          <KPI label="Customers"      value={counts.customer ?? 0} trend={`${counts.lead ?? 0} prospects too`} />
        </div>
      )}

      {/* AI hint */}
      {!isLoading && (contacts?.length ?? 0) > 0 && selected.size > 0 && (
        <GeminiCard
          title={`${selected.size} contact${selected.size > 1 ? "s" : ""} selected`}
          actions={
            <div className="flex gap-2">
              <Button size="sm" icon="mail" onClick={() => startCampaign("email")}>
                Email campaign
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon="whatsapp"
                onClick={() => startCampaign("whatsapp")}
              >
                WhatsApp blast
              </Button>
              <Button size="sm" variant="ghost" icon="x" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          }
          compact
        >
          Ready to engage. Personalised messages perform <b>3× better</b> than blasts —
          consider segmenting by source (lead vs customer) for tailored copy.
        </GeminiCard>
      )}

      {/* Filter + search */}
      {!isLoading && contacts && contacts.length > 0 && (
        <>
          <TabBar value={tab} onChange={setTab} items={tabsWithCounts} />
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="text-xs text-ink-3">
              Showing {filtered.length} of {counts.all ?? 0} contacts
              {selected.size > 0 && ` · ${selected.size} selected`}
            </div>
            <div className="w-72">
              <Input
                prefix={<Icon name="search" size={14} />}
                placeholder="Name, email, phone, company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <EmptyState
          icon="alert"
          title="Could not load contacts"
          body={error.message}
          action={<Button icon="refresh" onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <Card flush>
          <table className="w-full">
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-hairline">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="p-3"><Skeleton className="h-3 w-full" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !error && contacts && contacts.length === 0 && (
        <EmptyState
          icon="users"
          title="No contacts yet"
          body="Contacts will appear as you add leads and customers."
        />
      )}

      {/* Filtered empty */}
      {!isLoading && !error && contacts && contacts.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon="search"
          title="No contacts match"
          body={search ? `No results for "${search}".` : `No contacts in "${tab}".`}
          action={<Button icon="x" onClick={() => { setTab("all"); setSearch(""); }}>Clear filters</Button>}
          compact
        />
      )}

      {/* Mobile card list — phones only */}
      {!isLoading && !error && filtered.length > 0 && (
        <ul className="md:hidden space-y-2 mb-3">
          {filtered.map((c) => (
            <li key={c.id} className="bg-paper border border-hairline rounded-lg p-3">
              <div className="flex items-start gap-3">
                <Avatar
                  initials={c.name ? initials(c.name) : "?"}
                  color={c.source === "customer" ? "emerald" : "amber"}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">
                    {c.name ?? <span className="italic text-ink-3">No name</span>}
                  </p>
                  {c.company && <p className="text-xs text-ink-3 truncate mt-0.5">{c.company}</p>}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block font-mono text-[11px] text-amber-ink truncate mt-1"
                    >
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block font-mono text-[11px] text-amber-ink truncate"
                    >
                      {c.phone}
                    </a>
                  )}
                </div>
                <div className="shrink-0">
                  <Badge
                    kind={c.source === "customer" ? "success" : c.source === "imported" ? "info" : "warning"}
                    size="sm"
                    dot
                  >
                    {c.source === "customer" ? "Customer" : c.source === "imported" ? "Imported" : "Lead"}
                  </Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Desktop table */}
      {!isLoading && !error && filtered.length > 0 && (
        <Card flush className="hidden md:block">
          <table className="w-full">
            <thead className="bg-paper-2 border-b border-hairline">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 accent-amber cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Name</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Company</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Email</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Phone</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Source</th>
                <th className="text-left p-3 text-xs font-semibold text-ink-3 uppercase tracking-wider">Created</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    onClick={() => toggleOne(c.id)}
                    className={`border-b border-hairline last:border-0 hover:bg-paper-2/40 cursor-pointer transition-colors ${
                      isSelected ? "bg-amber-soft/40" : ""
                    }`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(c.id)}
                        className="w-3.5 h-3.5 accent-amber cursor-pointer"
                        aria-label={`Select ${c.name ?? c.email}`}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={c.name ? initials(c.name) : "?"}
                          color={c.source === "customer" ? "emerald" : "amber"}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-ink truncate">
                            {c.name ?? <span className="italic text-ink-3">No name</span>}
                          </div>
                          {c.title && (
                            <div className="text-[11px] text-ink-3 truncate">{c.title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-ink-2">{c.company}</td>
                    <td className="p-3 text-xs font-mono text-ink-2 truncate max-w-[200px]">
                      {c.email ?? "—"}
                    </td>
                    <td className="p-3 text-xs font-mono text-ink-2">{c.phone ?? "—"}</td>
                    <td className="p-3">
                      <Badge
                        kind={c.source === "customer" ? "success" : c.source === "imported" ? "info" : "warning"}
                        dot
                      >
                        {c.source === "customer" ? "Customer" : c.source === "imported" ? "Imported" : "Lead"}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-ink-3">{formatDate(c.createdAt)}</td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {c.source === "imported" ? (
                        <Button
                          size="sm"
                          variant="primary"
                          icon="arrow_right"
                          onClick={(e) => { e.stopPropagation(); promoteOne(c.refId); }}
                          title="Convert this contact into a lead at stage='new'"
                        >
                          Promote
                        </Button>
                      ) : (
                        <IconButton
                          icon="arrow_right"
                          size="sm"
                          variant="ghost"
                          aria-label="Open record"
                          onClick={() => {
                            const path =
                              c.source === "lead"
                                ? `/leads?lead=${c.refId}`
                                : `/customers/${c.refId}`;
                            router.push(path as never);
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Floating campaign bar — alternative when GeminiCard not visible */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-paper rounded-full pl-4 pr-2 py-2 shadow-lg flex items-center gap-3 z-40">
          <span className="text-sm">
            <b>{selected.size}</b> selected
          </span>
          <button
            onClick={() => startCampaign("email")}
            className="text-xs px-3 py-1 rounded-full bg-paper/10 hover:bg-paper/20 transition-colors flex items-center gap-1"
          >
            <Icon name="mail" size={12} /> Email
          </button>
          <button
            onClick={() => startCampaign("whatsapp")}
            className="text-xs px-3 py-1 rounded-full bg-amber text-paper hover:bg-amber/90 transition-colors flex items-center gap-1"
          >
            <Icon name="whatsapp" size={12} /> WhatsApp blast
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs px-2 py-1 rounded-full opacity-70 hover:opacity-100"
            aria-label="Clear selection"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
