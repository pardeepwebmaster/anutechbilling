/**
 * CommandPalette — global ⌘K / Ctrl+K search.
 *
 * Includes:
 * - Navigate to any page
 * - Search customers / leads / quotes / invoices (stub data — to be wired to Supabase)
 * - Run quick actions (new lead, new quote, etc.)
 *
 * @example consumer-side
 * const { open, isOpen, setOpen } = useCommandPalette();
 * <button onClick={open}>⌘K</button>
 * <CommandPalette open={isOpen} onOpenChange={setOpen} />
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Command } from "cmdk";

import { Dialog, DialogContent, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { APP_NAV } from "@/lib/nav";
import { rupee, cn } from "@/lib/utils";
import { toast } from "sonner";
// Real-data queries — Linear/Notion-style universal search. Each hook is
// already cached by TanStack Query so opening the palette is instant once
// the user has visited the corresponding page at least once. First-time
// open shows a brief loading flicker per group (acceptable trade-off).
import { useLeads } from "@/lib/queries/leads";
import { useCustomers } from "@/lib/queries/customers";
import { useQuotes } from "@/lib/queries/quotes";
import { useAllContacts } from "@/lib/queries/contacts";

// ============================================================
// Hook to manage open state + register ⌘K shortcut
// ============================================================
export function useCommandPalette() {
  const [isOpen, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { isOpen, setOpen, open: () => setOpen(true), close: () => setOpen(false) };
}

// Cap per-group results to keep the palette scannable. Most users find
// their target in the first 5; we show 10 to be safe. cmdk's filter then
// narrows further as they type.
const MAX_PER_GROUP = 10;

// ============================================================
// CommandPalette
// ============================================================
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  // Pull real tenant-scoped data. RLS ensures we only see this tenant's
  // rows. Queries are cached by TanStack Query — opening the palette
  // multiple times is instant after first load.
  const { data: leads }     = useLeads();
  const { data: customers } = useCustomers();
  const { data: quotes }    = useQuotes({ status: "all" });
  const { data: contacts }  = useAllContacts();

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href as Route);
  };

  const runAction = (msg: string) => {
    onOpenChange(false);
    toast(msg);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className={cn(
            "p-0 max-w-2xl top-[12vh] translate-y-0",
            "overflow-hidden"
          )}
          hideClose
        >
          <Command
            label="Command palette"
            shouldFilter
            className="bg-transparent"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
              <Icon name="search" size={18} className="text-ink-3" />
              <Command.Input
                placeholder="Search customers, leads, quotes, invoices, or run an action…"
                className="flex-1 bg-transparent border-0 outline-none text-base text-ink placeholder:text-ink-3 font-sans"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-paper-2 border border-hairline text-ink-3 font-mono">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-ink-3">
                No results found.
              </Command.Empty>

              {/* Quick actions */}
              <Command.Group heading="Quick Actions" className="cmdk-group">
                <PaletteItem
                  icon="plus"
                  label="Create new lead"
                  meta="Add to Deal Pipeline"
                  onSelect={() => runAction("New lead form opening…")}
                />
                <PaletteItem
                  icon="file"
                  label="Create new quote"
                  meta="Open Quote Builder"
                  onSelect={() => go("/quotes/new")}
                />
                <PaletteItem
                  icon="users"
                  label="Add new customer"
                  meta="Create customer record"
                  onSelect={() => runAction("New customer form opening…")}
                />
                <PaletteItem
                  icon="send"
                  label="Launch new campaign"
                  meta="Email or WhatsApp blast"
                  onSelect={() => go("/campaigns")}
                />
                <PaletteItem
                  icon="refresh"
                  label="Sync vendor portals"
                  meta="Google CSP + M365 + Zoho"
                  onSelect={() => runAction("Syncing all vendor portals…")}
                />
                <PaletteItem
                  icon="mail"
                  label="Send renewal reminders"
                  meta="To customers expiring in 30d"
                  onSelect={() => runAction("Sent renewal reminders to 12 customers")}
                />
              </Command.Group>

              {/* Pages */}
              <Command.Group heading="Pages">
                {APP_NAV.flatMap((section) =>
                  section.items.map((item) => (
                    <PaletteItem
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      meta={section.section}
                      onSelect={() => go(item.href)}
                    />
                  ))
                )}
              </Command.Group>

              {/* Customers — real, tenant-scoped */}
              {customers && customers.length > 0 && (
                <Command.Group heading={`Customers · ${customers.length}`}>
                  {customers.slice(0, MAX_PER_GROUP).map((c) => {
                    const meta = [c.contact_name, c.contact_email, c.domain].filter(Boolean).join(" · ");
                    return (
                      <PaletteItem
                        key={c.id}
                        icon="users"
                        label={c.name}
                        meta={meta || c.id}
                        onSelect={() => go(`/customers/${c.id}`)}
                      />
                    );
                  })}
                </Command.Group>
              )}

              {/* Leads — real, tenant-scoped. Deep-links to /leads?lead=<id>
                  which pops the detail drawer (existing pattern). */}
              {leads && leads.length > 0 && (
                <Command.Group heading={`Leads · ${leads.length}`}>
                  {leads.slice(0, MAX_PER_GROUP).map((l) => {
                    const stage = l.stage ? `${l.stage}` : "";
                    const value = l.value ? rupee(l.value, { compact: true }) : "";
                    const plan = l.plan ?? "No plan";
                    const meta = [plan, value, stage].filter(Boolean).join(" · ");
                    return (
                      <PaletteItem
                        key={l.id}
                        icon="target"
                        label={l.company}
                        meta={meta}
                        onSelect={() => go(`/leads?lead=${l.id}`)}
                      />
                    );
                  })}
                </Command.Group>
              )}

              {/* Contacts — unified across leads/customers/imported */}
              {contacts && contacts.length > 0 && (
                <Command.Group heading={`Contacts · ${contacts.length}`}>
                  {contacts.slice(0, MAX_PER_GROUP).map((c) => (
                    <PaletteItem
                      key={c.id}
                      icon="user"
                      label={c.name || c.email || c.phone || "(unnamed)"}
                      meta={[c.company, c.email, c.phone].filter(Boolean).join(" · ")}
                      onSelect={() => go("/contacts")}
                    />
                  ))}
                </Command.Group>
              )}

              {/* Quotes — real tenant-scoped quotes with status + ₹ */}
              {quotes && quotes.length > 0 && (
                <Command.Group heading={`Quotes · ${quotes.length}`}>
                  {quotes.slice(0, MAX_PER_GROUP).map((q) => {
                    const total = q.amount != null ? rupee(q.amount, { compact: true }) : "";
                    const meta = [q.customer_name, total, q.status].filter(Boolean).join(" · ");
                    return (
                      <PaletteItem
                        key={q.id}
                        icon="file"
                        label={q.id}
                        meta={meta}
                        onSelect={() => go(`/quotes/${q.id}`)}
                      />
                    );
                  })}
                </Command.Group>
              )}
            </Command.List>

            {/* Footer hint */}
            <div className="flex items-center gap-3 px-3 py-2 border-t border-hairline bg-paper-2 text-[11px] text-ink-3">
              <span className="flex items-center gap-1">
                <kbd className="text-[10px] px-1 py-0.5 rounded bg-paper border border-hairline font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="text-[10px] px-1 py-0.5 rounded bg-paper border border-hairline font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="text-[10px] px-1 py-0.5 rounded bg-paper border border-hairline font-mono">ESC</kbd>
                close
              </span>
            </div>
          </Command>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

// ============================================================
// PaletteItem — styled cmdk Item
// ============================================================
function PaletteItem({
  icon,
  label,
  meta,
  onSelect,
}: {
  icon: string;
  label: string;
  meta?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer",
        "data-[selected=true]:bg-paper-2",
        "text-ink hover:bg-paper-2"
      )}
    >
      <Icon name={icon} size={15} className="text-ink-3 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        {meta && <div className="text-[11px] text-ink-3 truncate">{meta}</div>}
      </div>
    </Command.Item>
  );
}
