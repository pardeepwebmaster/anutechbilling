/**
 * Sidebar — main app navigation rail.
 *
 * Desktop: sticky 240px rail
 * Mobile: slide-in sheet triggered by hamburger in TopBar
 *
 * Active state derived from Next.js usePathname().
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { APP_NAV } from "@/lib/nav";
import { useNavBadges } from "@/lib/hooks/useNavBadges";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

// ============================================================
// SidebarContent — shared between desktop + mobile
// ============================================================
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname    = usePathname();
  const navBadges   = useNavBadges();
  const { data: me } = useCurrentUser();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand — shows the LOGGED-IN tenant name (not hardcoded) */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-hairline flex-shrink-0">
        <div className="w-9 h-9 rounded-md bg-ink text-paper grid place-items-center font-serif text-lg">
          R
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">ResellerOS</div>
          <div className="text-[11px] text-ink-3 truncate" title={me?.tenantName ?? "Workspace"}>
            {me?.tenantName ?? "Workspace"}
          </div>
        </div>
      </div>

      {/* Nav scroll area */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {APP_NAV.map((section) => (
          <div key={section.section}>
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1">
              {section.section}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href as any}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm",
                      "transition-colors",
                      active
                        ? "bg-amber-soft text-amber-ink font-medium"
                        : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon
                      name={item.icon}
                      size={15}
                      className={cn(
                        "flex-shrink-0",
                        active ? "text-amber" : "text-ink-3 group-hover:text-ink-2"
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {(item.badge ?? navBadges[item.id as keyof typeof navBadges]) && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums flex-shrink-0",
                          active ? "bg-amber/15 text-amber" : "bg-paper-2 text-ink-3"
                        )}
                      >
                        {item.badge ?? navBadges[item.id as keyof typeof navBadges]}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer — shows REAL logged-in user (not hardcoded) */}
      <div className="border-t border-hairline p-3 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-paper-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2">
            <Avatar
              initials={me?.initials ?? "?"}
              color={(me?.color as any) ?? "amber"}
              size="md"
              status="online"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {me?.fullName ?? me?.authEmail ?? "Loading…"}
              </div>
              <div className="text-[11px] text-ink-3 truncate">
                {me ? (
                  <>
                    <span className="capitalize">{me.role ?? "Member"}</span>
                    {" · "}
                    <span>{me.tenantName}</span>
                  </>
                ) : (
                  "Workspace"
                )}
              </div>
            </div>
            <Icon name="chevron_up" size={13} className="text-ink-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>
              {me?.authEmail ?? "Account"}
            </DropdownMenuLabel>
            <DropdownMenuItem>
              <Icon name="user" size={14} /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon name="settings" size={14} /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon name="users" size={14} /> Team
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={async () => {
                const { createClient } = await import("@/lib/supabase/client");
                await createClient().auth.signOut();
                window.location.href = "/login";
              }}
            >
              <Icon name="logout" size={14} /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================
// Sidebar — desktop fixed rail
// ============================================================
export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-hairline bg-paper sticky top-0 h-screen">
      <SidebarContent />
    </aside>
  );
}

// ============================================================
// MobileSidebar — slide-out sheet (triggered by hamburger in TopBar)
// ============================================================
export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 p-0 md:hidden"
        hideClose
      >
        <SidebarContent onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
