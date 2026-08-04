/**
 * NotificationPanel — slide-out (Sheet) showing REAL recent events for this
 * tenant. No sample/placeholder data — a brand-new empty workspace correctly
 * shows an empty state, never fabricated money.
 *
 * Sources (all tenant-scoped via RLS):
 *   • Tasks due today or overdue  → actionable "follow-up" alerts (drive unread)
 *   • Leads created in the last 7 days → informational "new lead" events
 * Read-state is remembered in localStorage so "Mark all read" sticks.
 * Realtime push can later prepend to this same list.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, rupee, formatDate } from "@/lib/utils";
import { useTasks } from "@/lib/queries/tasks";
import { useLeads } from "@/lib/queries/leads";

type NotifTone = "emerald" | "indigo" | "amber" | "rose" | "slate";

interface Notification {
  id: string;
  title: string;
  meta: string;
  icon: string;
  tone: NotifTone;
  unread: boolean;
  link: string;
  when: number; // ms, for sorting
}

const READ_KEY = "ros_notif_read";

/** End-of-today and start-of-today as UTC ms, computed in IST (matches the
 *  tasks query's day boundary so "due today / overdue" agrees with the badge). */
function todayBoundsIST() {
  const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
  const endMs = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + 1) - 5.5 * 3600 * 1000;
  return { start: endMs - 24 * 3600 * 1000, end: endMs };
}

export function NotificationPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: tasks } = useTasks("all");
  const { data: leads } = useLeads();

  // Persisted read-state so "Mark all read" survives refresh.
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    try {
      const s = localStorage.getItem(READ_KEY);
      if (s) setReadIds(new Set(JSON.parse(s) as string[]));
    } catch { /* ignore */ }
  }, []);
  const persistRead = (next: Set<string>) => {
    setReadIds(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };

  const items = React.useMemo<Notification[]>(() => {
    const out: Notification[] = [];
    const { start, end } = todayBoundsIST();

    // 1. Actionable: tasks due today or overdue (pending / snoozed only).
    for (const t of tasks ?? []) {
      if (t.status !== "pending" && t.status !== "snoozed") continue;
      const due = new Date(t.due_at).getTime();
      if (due >= end) continue; // future tasks aren't "notifications" yet
      const overdue = due < start;
      const who = t.leads?.company ?? t.customers?.name ?? t.quotes?.customer_name ?? null;
      out.push({
        id: `task-${t.id}`,
        title: t.title,
        meta: `${overdue ? "Overdue" : "Due today"}${who ? ` · ${who}` : ""} · ${formatDate(t.due_at)}`,
        icon: overdue ? "alert" : "clock",
        tone: overdue ? "rose" : "amber",
        unread: !readIds.has(`task-${t.id}`),
        link: t.lead_id ? `/leads?lead=${t.lead_id}` : "/tasks",
        when: due,
      });
    }

    // 2. Informational: leads that arrived in the last 7 days.
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    for (const l of leads ?? []) {
      const created = new Date(l.created_at).getTime();
      if (created < weekAgo) continue;
      out.push({
        id: `lead-${l.id}`,
        title: `New lead · ${l.company}`,
        meta: `${formatDate(l.created_at)}${l.value ? ` · ${rupee(l.value, { compact: true })}` : ""}${l.contact_name ? ` · ${l.contact_name}` : ""}`,
        icon: "target",
        tone: "amber",
        unread: false, // info, doesn't drive the unread dot
        link: `/leads?lead=${l.id}`,
        when: created,
      });
    }

    return out.sort((a, b) => b.when - a.when).slice(0, 30);
  }, [tasks, leads, readIds]);

  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => {
    const next = new Set(readIds);
    items.forEach((n) => next.add(n.id));
    persistRead(next);
  };

  const openItem = (n: Notification) => {
    const next = new Set(readIds);
    next.add(n.id);
    persistRead(next);
    onOpenChange(false);
    router.push(n.link as never);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" hideClose>
        {/* Header */}
        <SheetHeader className="!p-4 flex flex-row items-center justify-between gap-2 border-b border-hairline">
          <div>
            <SheetTitle className="text-base">Notifications</SheetTitle>
            <SheetDescription className="text-[11px] mt-0.5">
              {items.length === 0
                ? "You're all caught up"
                : unreadCount > 0
                ? `${unreadCount} need${unreadCount === 1 ? "s" : ""} attention · ${items.length} recent`
                : `All caught up · ${items.length} recent`}
            </SheetDescription>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className={cn(
                "text-xs font-medium px-2 py-1 rounded",
                unreadCount === 0
                  ? "text-ink-3 cursor-default"
                  : "text-indigo hover:bg-indigo-soft cursor-pointer",
              )}
            >
              Mark all read
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded hover:bg-paper-2"
              aria-label="Close notifications"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </SheetHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <EmptyState
              icon="bell"
              title="You're all caught up"
              body="Follow-ups due today and new leads will show up here."
            />
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={cn(
                  "w-full px-4 py-3 border-b border-hairline last:border-0 flex gap-3 items-start text-left",
                  "hover:bg-paper-2 transition-colors",
                  n.unread && "bg-paper-2/60",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full grid place-items-center flex-shrink-0",
                    n.tone === "emerald" && "bg-emerald-soft text-emerald",
                    n.tone === "indigo" && "bg-indigo-soft text-indigo",
                    n.tone === "amber" && "bg-amber-soft text-amber",
                    n.tone === "rose" && "bg-rose-soft text-rose",
                    n.tone === "slate" && "bg-slate-soft text-slate",
                  )}
                >
                  <Icon name={n.icon} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm leading-snug text-ink",
                      n.unread ? "font-semibold" : "font-normal",
                    )}
                  >
                    {n.title}
                  </div>
                  <div className="text-[11px] text-ink-3 mt-1 leading-snug">{n.meta}</div>
                </div>
                {n.unread && (
                  <span className="w-2 h-2 rounded-full bg-indigo flex-shrink-0 mt-1.5" aria-hidden="true" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-hairline bg-paper-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            icon="clock"
            onClick={() => {
              onOpenChange(false);
              router.push("/tasks" as never);
            }}
          >
            All tasks
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
