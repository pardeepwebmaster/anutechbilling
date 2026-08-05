/**
 * InvoiceChooserDialog — pick what kind of thing you're invoicing, then route to
 * the RIGHT builder (both pull items from the catalog + handle GST/foreign):
 *   • Subscription / service → the quote-builder in invoice mode (?invoice=1)
 *   • Project                → the project builder in invoice mode
 *
 * Keeps one entry point ("Invoice") while reusing the tested builders instead of a
 * bespoke invoice form.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  /** Parent opens the project builder (invoice mode) when the user picks Project. */
  onChooseProject: () => void;
}

export function InvoiceChooserDialog({ open, onOpenChange, customerId, onChooseProject }: Props) {
  const router = useRouter();

  const choose = (kind: "subscription" | "project") => {
    onOpenChange(false);
    if (kind === "subscription") {
      router.push(`/quotes/new?customer=${customerId}&invoice=1` as never);
    } else {
      onChooseProject();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>What are you billing for? Items come from your catalog.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => choose("subscription")}
            className="flex items-start gap-3 rounded-lg border border-hairline bg-paper p-4 text-left hover:border-amber hover:bg-amber-soft/20 transition-colors"
          >
            <span className="mt-0.5 text-amber"><Icon name="refresh" size={20} /></span>
            <span>
              <span className="block font-medium text-ink">Subscription / service</span>
              <span className="block text-[12px] text-ink-3 mt-0.5">
                Catalog plans/services (Workspace, M365, seats…). One-time or recurring. Foreign customer → auto zero-rated.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose("project")}
            className="flex items-start gap-3 rounded-lg border border-hairline bg-paper p-4 text-left hover:border-amber hover:bg-amber-soft/20 transition-colors"
          >
            <span className="mt-0.5 text-indigo"><Icon name="package" size={20} /></span>
            <span>
              <span className="block font-medium text-ink">Project</span>
              <span className="block text-[12px] text-ink-3 mt-0.5">
                Custom / one-time project work (milestone catalog items). The full invoice is raised immediately.
              </span>
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
