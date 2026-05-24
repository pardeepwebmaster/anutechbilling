/**
 * TopBar — sticky header with breadcrumb, ⌘K search, theme toggle, bell.
 *
 * Mounted by the (app) layout group.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { CommandPalette, useCommandPalette } from "./command-palette";
import { NotificationPanel } from "./notification-panel";
import { getCrumb } from "@/lib/nav";
import { useTaskCountDueOrOverdue } from "@/lib/queries/tasks";

interface TopBarProps {
  /** Open the mobile sidebar */
  onMobileMenuClick: () => void;
  /** Override breadcrumb (otherwise auto from pathname) */
  crumb?: string[];
}

export function TopBar({ onMobileMenuClick, crumb: crumbOverride }: TopBarProps) {
  const pathname = usePathname();
  const crumb = crumbOverride ?? getCrumb(pathname);
  const { setTheme, resolvedTheme } = useTheme();
  const cmdk = useCommandPalette();
  const [notifOpen, setNotifOpen] = React.useState(false);

  // Bell badge = open tasks due by end of today (today + overdue). When push
  // notifications + WhatsApp reminders arrive in Phase 2 they'll feed the
  // same number (any unread notification becomes a virtual task surface).
  const { data: taskCount } = useTaskCountDueOrOverdue();
  const unreadCount = taskCount ?? 0;

  // Mount-only flag to avoid theme hydration mismatch
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-hairline bg-paper/95 backdrop-blur-sm flex items-center gap-2 px-3 md:px-4">
      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2 -ml-2 rounded-md hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        onClick={onMobileMenuClick}
        aria-label="Open menu"
      >
        <Icon name="list" size={18} />
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-ink-3">
        <Link href="/dashboard" className="hover:text-ink">
          <Icon name="home" size={13} />
        </Link>
        {crumb.map((label, i) => (
          <React.Fragment key={i}>
            <span className="text-ink-3">/</span>
            <span
              className={i === crumb.length - 1 ? "font-semibold text-ink" : "text-ink-3"}
            >
              {label}
            </span>
          </React.Fragment>
        ))}
      </nav>

      <div className="flex-1" />

      {/* ⌘K Search trigger */}
      <button
        onClick={cmdk.open}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-hairline hover:border-hairline-strong bg-paper-2 text-ink-3 text-xs min-w-[200px] md:min-w-[280px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2"
      >
        <Icon name="search" size={13} />
        <span className="flex-1 text-left">Search customers, leads, quotes…</span>
        <kbd className="hidden md:inline-block text-[10px] px-1.5 py-0.5 rounded bg-paper border border-hairline text-ink-3 font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            icon={mounted && resolvedTheme === "dark" ? "sun" : "moon"}
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          />
        </TooltipTrigger>
        <TooltipContent>Toggle theme</TooltipContent>
      </Tooltip>

      {/* Notifications */}
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              icon="bell"
              aria-label={`${unreadCount} unread notifications`}
              onClick={() => setNotifOpen(true)}
            />
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose text-white text-[9px] font-bold grid place-items-center ring-2 ring-paper pointer-events-none tabular-nums"
            aria-hidden="true"
          >
            {unreadCount}
          </span>
        )}
      </div>

      {/* Mounted panels */}
      <CommandPalette open={cmdk.isOpen} onOpenChange={cmdk.setOpen} />
      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />
    </header>
  );
}
