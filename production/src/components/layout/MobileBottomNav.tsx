/**
 * MobileBottomNav — sticky bottom tab bar for phone-sized screens.
 *
 * Why: on mobile, the sidebar lives behind a hamburger menu — fine for
 * occasional navigation, terrible for the 5 most-used sections. A bottom
 * tab bar in the thumb zone (matches WhatsApp, Gmail, every banking app
 * in India) makes those one-tap navigations a thumb flick away.
 *
 * Layout:
 *   - hidden md:hidden (mobile only, < 768px)
 *   - fixed bottom-0 inset-x-0 (full-width bar at viewport bottom)
 *   - safe-area-padding-bottom for iPhone notch / Android gesture bar
 *   - bg-paper with top border
 *   - 5 equal-width slots
 *
 * Tab choice (5 most-used):
 *   1. Dashboard  — morning glance
 *   2. Deals      — sales team's primary surface
 *   3. Quotes     — what's in flight
 *   4. Tasks      — today's follow-ups
 *   5. More       — opens the existing MobileSidebar drawer for everything else
 *
 * Active state matches current pathname start (so /quotes/Q-2026-27-0001
 * still highlights the Quotes tab).
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  id:     string;
  href:   string;
  label:  string;
  icon:   string;
  /** When set, clicking opens a sheet rather than navigating. */
  action?: "menu";
}

const MOBILE_BOTTOM_TABS: BottomNavItem[] = [
  { id: "dashboard", href: "/dashboard", label: "Home",   icon: "home"   },
  { id: "leads",     href: "/leads",     label: "Deals",  icon: "target" },
  { id: "quotes",    href: "/quotes",    label: "Quotes", icon: "file"   },
  { id: "tasks",     href: "/tasks",     label: "Tasks",  icon: "clock"  },
  { id: "more",      href: "#",          label: "More",   icon: "more_h", action: "menu" },
];

interface Props {
  /** Called when the "More" tab is tapped — opens the MobileSidebar drawer. */
  onMoreClick: () => void;
}

export function MobileBottomNav({ onMoreClick }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        // visibility — phones only
        "md:hidden",
        // positioning
        "fixed inset-x-0 bottom-0 z-40",
        // appearance
        "bg-paper border-t border-hairline shadow-[0_-1px_3px_rgba(0,0,0,0.04)]",
        // safe-area for notched / gesture-bar devices
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Primary navigation"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_BOTTOM_TABS.map((item) => {
          const active = item.action === "menu"
            ? false
            : pathname.startsWith(item.href);

          const inner = (
            <span
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                "min-h-[56px]", // touch-target floor (≥44px + label)
                active ? "text-amber-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              <Icon name={item.icon} size={20} />
              <span className="text-[10px] font-medium leading-tight">
                {item.label}
              </span>
            </span>
          );

          if (item.action === "menu") {
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={onMoreClick}
                  className="w-full"
                  aria-label="Open full menu"
                >
                  {inner}
                </button>
              </li>
            );
          }
          return (
            <li key={item.id}>
              <Link
                href={item.href as never}
                className="block"
                aria-current={active ? "page" : undefined}
              >
                {inner}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
