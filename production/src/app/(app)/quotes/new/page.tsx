/**
 * /quotes/new — create a new quote.
 *
 * QuoteBuilder uses useSearchParams() to pick up `?duplicate=...` / `?leadId=...`
 * params from the lead drawer "Send quote" CTA. Next.js requires those readers
 * to live under a Suspense boundary so static prerender can bail out gracefully.
 */
import { Suspense } from "react";
import { QuoteBuilder } from "@/components/features/quotes/quote-builder";

export const metadata = { title: "New Quote" };

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-3">Loading quote builder…</div>}>
      <QuoteBuilder />
    </Suspense>
  );
}
