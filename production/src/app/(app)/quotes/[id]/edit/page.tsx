/**
 * /quotes/{id}/edit — the "Edit" button on the quote detail page links
 * here, but there was no route here at all (real bug — 404). QuoteBuilder
 * reads everything from search params (matching its existing ?duplicate=
 * convention), so this just forwards into that with ?edit=<id> rather than
 * duplicating QuoteBuilder's already-large prop-free design.
 */
import { redirect } from "next/navigation";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/quotes/new?edit=${encodeURIComponent(id)}`);
}
