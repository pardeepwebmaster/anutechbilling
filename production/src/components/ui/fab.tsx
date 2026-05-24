/**
 * FAB — Floating Action Button (mobile-first primary action).
 *
 * Material-style fixed circular/pill button anchored to bottom-right
 * (above the bottom-nav, in the thumb zone). Used as the primary
 * call-to-action on listing pages where the desktop "+ Add" sits in the
 * header — too far to thumb-reach on mobile.
 *
 * Convention:
 *   - md:hidden by default — phones only. Desktop already has the
 *     header button. Pass `showOnDesktop` to override for special cases.
 *   - Positioned `right-4 bottom-20` (above the 64px bottom nav).
 *   - Branded amber background, white text.
 *   - When label provided, renders as a pill (extended FAB) — better
 *     affordance than icon-only. Icon-only available via `icon`-only.
 *
 * @example
 *   <FAB icon="plus" label="New quote" onClick={() => router.push('/quotes/new')} />
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface FABBaseProps {
  /** lucide icon name (from our Icon component). */
  icon:  string;
  /** When set, renders as a pill (extended FAB) with text. */
  label?: string;
  /** Override default md:hidden — render on desktop too. */
  showOnDesktop?: boolean;
  /** Extra classes for fine-tuning position. */
  className?: string;
  ariaLabel?: string;
}

type FABButtonProps = FABBaseProps & {
  onClick: () => void;
  href?: never;
};

type FABLinkProps = FABBaseProps & {
  href: string;
  onClick?: never;
};

export type FABProps = FABButtonProps | FABLinkProps;

const baseStyles = cn(
  // Position — above the bottom-nav (~56-64px), thumb zone
  "fixed right-4 bottom-20 md:bottom-6 z-30",
  // Shape + colour
  "inline-flex items-center justify-center gap-2",
  "rounded-full bg-amber text-white shadow-lg shadow-amber/30",
  // Sizing — generous touch target (≥48px)
  "h-14 px-5",
  // Behaviour
  "hover:brightness-105 active:brightness-95 transition-all",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2",
  // Safe area for notched / gesture devices
  "mb-[env(safe-area-inset-bottom)]",
);

export function FAB(props: FABProps) {
  const { icon, label, showOnDesktop, className, ariaLabel } = props;
  const visibility = showOnDesktop ? "" : "md:hidden";

  const content = (
    <>
      <Icon name={icon} size={20} />
      {label && <span className="text-sm font-semibold whitespace-nowrap">{label}</span>}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href as never}
        className={cn(baseStyles, visibility, className)}
        aria-label={ariaLabel ?? label ?? icon}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={(props as FABButtonProps).onClick}
      className={cn(baseStyles, visibility, className)}
      aria-label={ariaLabel ?? label ?? icon}
    >
      {content}
    </button>
  );
}
