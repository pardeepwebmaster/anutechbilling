/**
 * /support — reseller-side support ticket inbox.
 *
 * Pardeep sees every ticket raised by customers via the portal +
 * manually-created tickets. Action buttons let him move ticket through
 * the lifecycle (in_progress → resolved) and add a resolution note
 * that's visible to the customer on /portal/support.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { SupportTicketRow, SupportTicketStatus } from "@/lib/supabase/database.types";

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open:              "Open",
  in_progress:       "In progress",
  awaiting_customer: "Awaiting customer",
  resolved:          "Resolved",
  closed:            "Closed",
};
const STATUS_COLOR: Record<SupportTicketStatus, "rose" | "amber" | "indigo" | "emerald" | "slate"> = {
  open:              "rose",
  in_progress:       "amber",
  awaiting_customer: "indigo",
  resolved:          "emerald",
  closed:            "slate",
};
const STATUSES: ("all" | SupportTicketStatus)[] = ["open", "in_progress", "awaiting_customer", "resolved", "closed", "all"];

function useTickets(status: "all" | SupportTicketStatus) {
  return useQuery({
    queryKey: ["support_tickets", status],
    queryFn: async (): Promise<SupportTicketRow[]> => {
      const supabase = createClient();
      let q = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SupportTicketRow[];
    },
  });
}

function useTicketCounts() {
  return useQuery({
    queryKey: ["support_tickets", "counts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("support_tickets").select("status");
      const out: Record<string, number> = { all: 0, open: 0, in_progress: 0, awaiting_customer: 0, resolved: 0, closed: 0 };
      for (const r of data ?? []) {
        out.all += 1;
        out[r.status as string] = (out[r.status as string] ?? 0) + 1;
      }
      return out;
    },
  });
}

export default function SupportPage() {
  const [tab, setTab] = React.useState<"all" | SupportTicketStatus>("open");
  const [selected, setSelected] = React.useState<SupportTicketRow | null>(null);
  const { data: tickets = [], isLoading } = useTickets(tab);
  const { data: counts }                  = useTicketCounts();
  const qc = useQueryClient();

  const updateTicket = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<SupportTicketRow, "id" | "tenant_id" | "created_at" | "updated_at">> }) => {
      const supabase = createClient();
      const { error } = await supabase.from("support_tickets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support_tickets"] });
      toast.success("Ticket updated");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight">Support Inbox</h1>
        <p className="text-sm text-ink-3 mt-1">
          Customer-raised tickets from the portal. Respond via WhatsApp / email,
          then mark resolved with a note here so the customer can see it.
        </p>
      </div>

      {/* Tab filter */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {STATUSES.map((s) => {
          const active = tab === s;
          const count  = counts?.[s] ?? 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-2 ${
                active
                  ? "border-amber bg-amber-soft text-amber-ink font-semibold"
                  : "border-hairline text-ink-3 hover:text-ink hover:bg-paper-2"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? "bg-paper text-amber-ink" : "bg-paper-2 text-ink-3"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : tickets.length === 0 ? (
        <Card className="py-2">
          <EmptyState
            icon="ticket"
            title="No tickets here"
            body="Open tickets will appear here as customers raise them on the portal."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-5 hover:bg-paper-2/30 cursor-pointer" onClick={() => setSelected(t)}>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                <div className="min-w-0">
                  <div className="font-medium text-ink leading-tight">{t.subject}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">
                    <span className="font-mono">{t.id}</span>
                    <span className="mx-1.5">·</span>
                    {t.customer_name}
                    <span className="mx-1.5">·</span>
                    {formatDate(t.created_at.slice(0, 10))}
                    <span className="mx-1.5">·</span>
                    {t.category.replace("_", " ")}
                    {t.priority !== "normal" && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span className={t.priority === "urgent" ? "text-rose font-semibold" : "text-amber-ink"}>
                          {t.priority}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Badge color={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              </div>
              <p className="text-sm text-ink-2 leading-relaxed line-clamp-2 mt-1">{t.body}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      {selected && (
        <TicketDetail
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => updateTicket.mutateAsync({ id: selected.id, patch })}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Detail modal — show + action
// ────────────────────────────────────────────────────────────────

function TicketDetail({
  ticket, onClose, onUpdate,
}: {
  ticket: SupportTicketRow;
  onClose: () => void;
  onUpdate: (patch: Partial<Omit<SupportTicketRow, "id" | "tenant_id" | "created_at" | "updated_at">>) => Promise<unknown>;
}) {
  const [note, setNote]     = React.useState(ticket.resolution_note ?? "");
  const [busy, setBusy]     = React.useState(false);

  async function setStatus(newStatus: SupportTicketStatus) {
    setBusy(true);
    const patch: Partial<Omit<SupportTicketRow, "id" | "tenant_id" | "created_at" | "updated_at">> = { status: newStatus };
    if (newStatus === "resolved") {
      patch.resolved_at     = new Date().toISOString();
      patch.resolution_note = note;
    }
    try {
      await onUpdate(patch);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 z-40 grid place-items-center p-4" onClick={onClose}>
      <Card className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <Badge color={STATUS_COLOR[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
            <h2 className="font-serif text-xl text-ink leading-tight mt-2">{ticket.subject}</h2>
            <div className="text-[11px] text-ink-3 mt-1 font-mono">{ticket.id}</div>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><Icon name="x" size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs border-y border-hairline py-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Customer</div>
            <div className="text-ink">{ticket.customer_name}</div>
            <div className="text-ink-3 font-mono text-[11px]">{ticket.raised_by_email}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Category · Priority</div>
            <div className="text-ink">{ticket.category.replace("_", " ")}</div>
            <div className={`text-[11px] ${ticket.priority === "urgent" ? "text-rose font-semibold" : ticket.priority === "high" ? "text-amber-ink" : "text-ink-3"}`}>
              {ticket.priority} priority
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">Customer wrote</div>
          <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
        </div>

        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1 block">
            Your resolution note (shown to customer when you mark resolved)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-hairline rounded-md bg-paper"
            placeholder="What did you do to resolve this? What should they do next?"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {ticket.status === "open" && (
            <Button variant="default" loading={busy} onClick={() => setStatus("in_progress")}>
              Mark In Progress
            </Button>
          )}
          {ticket.status !== "awaiting_customer" && ticket.status !== "resolved" && ticket.status !== "closed" && (
            <Button variant="default" loading={busy} onClick={() => setStatus("awaiting_customer")}>
              Awaiting customer
            </Button>
          )}
          {ticket.status !== "resolved" && (
            <Button variant="primary" loading={busy} onClick={() => setStatus("resolved")}>
              <Icon name="check" size={12} className="mr-1" /> Mark resolved
            </Button>
          )}
          {ticket.status === "resolved" && (
            <Button variant="default" loading={busy} onClick={() => setStatus("closed")}>
              Close ticket
            </Button>
          )}
        </div>

        {/* WhatsApp shortcut */}
        <div className="mt-4 pt-4 border-t border-hairline text-center">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Hi, regarding your ticket ${ticket.id}: ${ticket.subject}\n\n`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-md text-paper"
            style={{ background: "#25D366" }}
          >
            <Icon name="whatsapp" size={12} /> Open WhatsApp template
          </a>
        </div>

        <div className="mt-3 text-center">
          <Link href={`/customers/${ticket.customer_id ?? ""}`} className="text-xs text-amber-ink hover:underline">
            View customer profile →
          </Link>
        </div>
      </Card>
    </div>
  );
}
