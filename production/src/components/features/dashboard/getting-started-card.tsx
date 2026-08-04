/**
 * GettingStartedCard — first-run onboarding for a new reseller.
 *
 * A new tenant lands on an empty dashboard with no idea what to do first. This
 * card gives a clear, 4-step guided path — each step checks off from REAL data
 * (no fake ticks), routes to the right screen, and the whole card auto-hides once
 * the reseller is set up. Momentum by design: every ✓ is a small win.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

interface Step {
  id:    string;
  label: string;
  hint:  string;
  href:  string;
  cta:   string;
  done:  boolean;
}

export function GettingStartedCard({
  setupDone, hasCustomer, hasQuote, hasSale, workspaceName,
}: {
  setupDone:    boolean;
  hasCustomer:  boolean;
  hasQuote:     boolean;
  hasSale:      boolean;
  workspaceName: string;
}) {
  const steps: Step[] = [
    { id: "setup",    label: "Set up your business & GST profile", hint: "GSTIN, state, logo — makes every invoice compliant.", href: "/setup",       cta: "Set up",      done: setupDone },
    { id: "customer", label: "Add your first customer",            hint: "Or import from CSV — takes a minute.",               href: "/customers",   cta: "Add customer", done: hasCustomer },
    { id: "quote",    label: "Create your first quote",            hint: "Pick from your catalog, send on WhatsApp/email.",     href: "/quotes/new",  cta: "New quote",    done: hasQuote },
    { id: "sale",     label: "Record your first payment",          hint: "When a customer pays, the sale + invoice happen here.", href: "/quotes",      cta: "View quotes",  done: hasSale },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  // Once everything is done, the card retires itself — no clutter for an active user.
  if (doneCount === steps.length) return null;

  const pct = Math.round((doneCount / steps.length) * 100);
  // The next actionable step gets the spotlight (primary CTA); the rest are quiet.
  const nextStep = steps.find((s) => !s.done);

  return (
    <Card className="mb-3 border-amber/30 bg-amber-soft/20">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-serif text-xl text-ink leading-tight flex items-center gap-2">
            <Icon name="rocket" size={18} className="text-amber" />
            Welcome{workspaceName ? <> to <span className="text-amber-ink">{workspaceName}</span></> : null} — let&apos;s get you selling
          </h2>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {doneCount} of {steps.length} done. A few minutes and you&apos;re ready to send your first quote.
          </p>
        </div>
        <div className="text-right">
          <span className="font-serif text-2xl text-amber tabular-nums">{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-paper-2 overflow-hidden mb-4">
        <div className="h-full bg-amber transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-2">
        {steps.map((s) => {
          const isNext = nextStep?.id === s.id;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                s.done ? "border-hairline bg-paper/60" : isNext ? "border-amber/40 bg-paper" : "border-hairline bg-paper"
              }`}
            >
              <span
                className={`grid place-items-center h-6 w-6 rounded-full shrink-0 ${
                  s.done ? "bg-emerald text-white" : "border-2 border-hairline-strong text-transparent"
                }`}
              >
                {s.done && <Icon name="check" size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${s.done ? "text-ink-3 line-through" : "text-ink"}`}>{s.label}</span>
                {!s.done && <span className="block text-[11px] text-ink-3">{s.hint}</span>}
              </span>
              {!s.done && (
                <Link
                  href={s.href as Route}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    isNext ? "bg-amber text-white hover:bg-amber-ink" : "border border-hairline text-ink-2 hover:bg-paper-2"
                  }`}
                >
                  {s.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
