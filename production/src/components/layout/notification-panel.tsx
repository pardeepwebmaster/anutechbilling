/**
 * NotificationPanel — slide-out (Sheet) showing recent events.
 *
 * Real implementation will use Supabase Realtime to push new events.
 * For now uses local state with sample stream.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================
// Sample stream — replace with Supabase Realtime later
// ============================================================
type NotifKind = "payment" | "order" | "trial" | "issue" | "renewal" | "risk" | "quote" | "lead" | "whatsapp" | "support";
type NotifTone = "emerald" | "indigo" | "amber" | "rose" | "slate";

interface Notification {
  id: string;
  type: NotifKind;
  title: string;
  meta: string;
  icon: string;
  tone: NotifTone;
  unread: boolean;
  link: string;
}

const SAMPLE_NOTIFICATIONS: Notification[] = [
  { id: "n1",  type: "payment", icon: "rupee",    tone: "emerald", unread: true,  link: "/invoices",      title: "Payment received · ₹3.05L from Acme Corp",         meta: "2 min ago · Invoice INV-2026-0156 · Razorpay" },
  { id: "n2",  type: "order",   icon: "cart",     tone: "indigo",  unread: true,  link: "/online-orders", title: "New paid order · Echo Pharma · 60 seats Plus",     meta: "18 min ago · ORD-2026-0088 · ₹11.7L total" },
  { id: "n3",  type: "trial",   icon: "rocket",   tone: "amber",   unread: true,  link: "/online-orders", title: "Trial started · Beta Industries · 15 seats",       meta: "1 hour ago · TRL-2026-0042 · Day 1 of 14" },
  { id: "n4",  type: "issue",   icon: "alert",    tone: "rose",    unread: true,  link: "/online-orders", title: "Provisioning failed · Hotel Asia Mumbai",          meta: "2 hours ago · Domain conflict · Needs manual fix" },
  { id: "n5",  type: "renewal", icon: "clock",    tone: "amber",   unread: false, link: "/renewals",      title: "Renewal in 2 days · Cosmo Tech · ₹16.5K MRR",      meta: "Sent reminder email · No response yet" },
  { id: "n6",  type: "risk",    icon: "alert",    tone: "rose",    unread: false, link: "/renewals",      title: "High-risk renewal flagged · Hotel Royal Group",    meta: "Low usage 65% · NPS 4/10 · 5 support tickets" },
  { id: "n7",  type: "quote",   icon: "file",     tone: "indigo",  unread: false, link: "/quotes",        title: "Quote viewed · Acme Corp opened Q-2026-0042",      meta: "3rd time in 24h · Strong buying signal" },
  { id: "n8",  type: "lead",    icon: "target",   tone: "amber",   unread: false, link: "/leads",         title: "New lead · Maple Studios · 12 seats Workspace",    meta: "Came via marketing landing · Auto-assigned to Priya" },
  { id: "n9",  type: "whatsapp",icon: "whatsapp", tone: "emerald", unread: false, link: "/whatsapp",      title: "WhatsApp · Karthik N replied",                     meta: "\"Can we schedule migration for Saturday?\"" },
  { id: "n10", type: "support", icon: "ticket",   tone: "emerald", unread: false, link: "/support",       title: "Support ticket #SUP-1247 resolved",                meta: "Rajesh marked as helpful · 5★ rating" },
];

// ============================================================
// NotificationPanel
// ============================================================
export function NotificationPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(SAMPLE_NOTIFICATIONS);
  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => {
    setItems(items.map((n) => ({ ...n, unread: false })));
    toast.success("All notifications marked as read");
  };

  const openItem = (n: Notification) => {
    setItems(items.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    onOpenChange(false);
    router.push(n.link as any);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" hideClose>
        {/* Header */}
        <SheetHeader className="!p-4 flex flex-row items-center justify-between gap-2 border-b border-hairline">
          <div>
            <SheetTitle className="text-base">Notifications</SheetTitle>
            <SheetDescription className="text-[11px] mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} unread · ${items.length} total`
                : `All caught up · ${items.length} total`}
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
                  : "text-indigo hover:bg-indigo-soft cursor-pointer"
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
              title="No notifications yet"
              body="Events from your reseller business will appear here."
            />
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={cn(
                  "w-full px-4 py-3 border-b border-hairline last:border-0 flex gap-3 items-start text-left",
                  "hover:bg-paper-2 transition-colors",
                  n.unread && "bg-paper-2/60"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full grid place-items-center flex-shrink-0",
                    n.tone === "emerald" && "bg-emerald-soft text-emerald",
                    n.tone === "indigo" && "bg-indigo-soft text-indigo",
                    n.tone === "amber" && "bg-amber-soft text-amber",
                    n.tone === "rose" && "bg-rose-soft text-rose",
                    n.tone === "slate" && "bg-slate-soft text-slate"
                  )}
                >
                  <Icon name={n.icon} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm leading-snug text-ink",
                      n.unread ? "font-semibold" : "font-normal"
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
            icon="settings"
            onClick={() => {
              onOpenChange(false);
              router.push("/automations" as any);
            }}
          >
            Settings
          </Button>
          <button className="text-xs text-indigo hover:underline font-medium">View all →</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
