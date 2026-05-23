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
import { Command } from "cmdk";

import { Dialog, DialogContent, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { APP_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

// ============================================================
// Stub data — replace with Supabase queries later
// ============================================================
const SAMPLE_CUSTOMERS = [
  { id: "acme",   name: "Acme Corp Pvt Ltd",   meta: "acmecorp.com · 25 seats" },
  { id: "cosmo",  name: "Cosmo Tech",          meta: "cosmotech.in · 12 seats" },
  { id: "delta",  name: "Delta Pvt Ltd",       meta: "deltapl.com · 50 seats" },
  { id: "echo",   name: "Echo Pharma",         meta: "echopharma.in · 80 seats" },
  { id: "beta",   name: "Beta Industries",     meta: "betaind.in · 15 seats" },
];

const SAMPLE_LEADS = [
  { id: "L17", company: "Acme Corp Pvt Ltd",  meta: "Plus upgrade · ₹4.9L · Quote sent" },
  { id: "L18", company: "Zephyr Networks",    meta: "Plus + Voice · ₹3.8L · Quote sent" },
  { id: "L14", company: "Whitestone Pharma",  meta: "Plus · ₹4.6L · Trial active" },
];

const SAMPLE_QUOTES = [
  { id: "Q-2026-0042", customer: "Acme Corp",      meta: "₹4.9L · Sent" },
  { id: "Q-2026-0041", customer: "Beta Industries", meta: "₹1.3L · Accepted" },
  { id: "Q-2026-0040", customer: "Anvil Heavy",     meta: "₹8.2L · Accepted" },
];

const SAMPLE_INVOICES = [
  { id: "INV-2026-0089", customer: "Acme Corp",       meta: "₹4.9L · Pending" },
  { id: "INV-2026-0085", customer: "Echo Pharma",     meta: "₹2.2L · Overdue 14d" },
];

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

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href as any);
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

              {/* Customers */}
              <Command.Group heading="Customers">
                {SAMPLE_CUSTOMERS.map((c) => (
                  <PaletteItem
                    key={c.id}
                    icon="users"
                    label={c.name}
                    meta={c.meta}
                    onSelect={() => go(`/customers/${c.id}`)}
                  />
                ))}
              </Command.Group>

              {/* Leads */}
              <Command.Group heading="Leads">
                {SAMPLE_LEADS.map((l) => (
                  <PaletteItem
                    key={l.id}
                    icon="target"
                    label={l.company}
                    meta={l.meta}
                    onSelect={() => go("/leads")}
                  />
                ))}
              </Command.Group>

              {/* Quotes */}
              <Command.Group heading="Quotes">
                {SAMPLE_QUOTES.map((q) => (
                  <PaletteItem
                    key={q.id}
                    icon="file"
                    label={`${q.id} — ${q.customer}`}
                    meta={q.meta}
                    onSelect={() => go(`/quotes/${q.id}`)}
                  />
                ))}
              </Command.Group>

              {/* Invoices */}
              <Command.Group heading="Invoices">
                {SAMPLE_INVOICES.map((i) => (
                  <PaletteItem
                    key={i.id}
                    icon="receipt"
                    label={`${i.id} — ${i.customer}`}
                    meta={i.meta}
                    onSelect={() => go("/invoices")}
                  />
                ))}
              </Command.Group>
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
