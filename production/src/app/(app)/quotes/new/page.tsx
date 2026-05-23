/**
 * /quotes/new — create a new quote.
 */
import { QuoteBuilder } from "@/components/features/quotes/quote-builder";

export const metadata = { title: "New Quote" };

export default function NewQuotePage() {
  return <QuoteBuilder />;
}
