import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

/**
 * Public marketing landing page.
 *
 * Designed for cold prospects (other Indian cloud resellers) and warm
 * referrals. Loads fast (no client components, no images), reads top-to-
 * bottom, and links to existing public pages (/about, /privacy, /terms).
 *
 * If the visitor is already authenticated, kick them to /dashboard.
 */
export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* ── Top nav ──────────────────────────────────────────────── */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-serif text-xl tracking-tight">
            ResellerOS
          </Link>
          <nav className="flex items-center gap-5 text-sm text-ink-2">
            <Link href={"/about" as never} className="hidden sm:inline hover:text-ink transition-colors">
              About
            </Link>
            <Link href="/login" className="hover:text-ink transition-colors">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Start free</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
        <Badge kind="info" dot className="mb-6">
          For Indian cloud resellers
        </Badge>

        <h1 className="mb-5 font-serif text-4xl leading-[1.1] tracking-tight sm:text-6xl">
          One OS for your reseller business.
          <br />
          <span className="text-ink-3">No more juggling seven tools.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-ink-2">
          ResellerOS handles leads, quotes, GST invoices, renewals, banking,
          and customer portal — purpose-built for Google Workspace, Microsoft 365,
          and Zoho resellers in India.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary" iconRight="arrow_right">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Button asChild variant="default">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <p className="mt-4 text-xs text-ink-3">
          14-day trial · No credit card · ₹0 to get started
        </p>
      </section>

      {/* ── Trust ribbon ─────────────────────────────────────────── */}
      <section className="border-y border-hairline bg-paper-2/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5 text-[12px] text-ink-3">
          <span className="font-mono">Built in Mumbai 🇮🇳</span>
          <span className="hidden sm:inline">·</span>
          <span>GST + HSN 998313 compliant</span>
          <span className="hidden sm:inline">·</span>
          <span>DPDP Act 2023 ready</span>
          <span className="hidden sm:inline">·</span>
          <span>Hosted on Google Cloud Mumbai</span>
        </div>
      </section>

      {/* ── Pain section ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="mb-10 text-center">
          <Badge kind="warning" size="sm" dot className="mb-3">If this sounds familiar</Badge>
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            You&rsquo;re running a reseller business across seven apps.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            "Spreadsheet for leads. WhatsApp for follow-ups. Memory for what was said.",
            "Tally / Zoho Books for invoices. Re-typing customer details every quote.",
            "Bank reconciliation on paper. Renewal reminders that get missed.",
            "GST filings that become a quarterly crisis. Margins that stay fuzzy.",
          ].map((line) => (
            <div
              key={line}
              className="flex items-start gap-3 rounded-md border border-hairline bg-paper-2/30 p-4"
            >
              <Icon name="x" className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
              <p className="text-sm leading-relaxed text-ink-2">{line}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What's inside ────────────────────────────────────────── */}
      <section className="border-y border-hairline bg-paper-2/40">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-10 text-center">
            <Badge kind="success" size="sm" dot className="mb-3">
              What&rsquo;s inside
            </Badge>
            <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
              17 modules. One database. Built to talk to each other.
            </h2>
            <p className="mt-3 text-base text-ink-3">
              Every module shares context — a lead becomes a quote becomes an
              invoice becomes a subscription becomes a renewal, with zero re-typing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Module icon="target" title="Lead → Deal pipeline">
              Inbox, smart views, Kanban, today strip, follow-up tasks.
            </Module>
            <Module icon="file" title="Quote builder">
              5 commitment types × 2 pricing tiers, per-line discounts, prospect mode.
            </Module>
            <Module icon="receipt" title="GST invoicing">
              CGST §31 compliant, partial invoices, advance adjustment, PDF download.
            </Module>
            <Module icon="refresh" title="Renewal automation">
              T-30 → T-0 cadence, auto-suspend with grace, dashboard widget.
            </Module>
            <Module icon="cart" title="Online orders + Razorpay">
              Public buy pages, BuyNowDialog, coupon codes, site promos.
            </Module>
            <Module icon="chart" title="Accounting layer">
              Vendor bills, expenses, P&amp;L, customer aging, MRR/ARR/Churn/LTV.
            </Module>
            <Module icon="rupee" title="TDS receivable">
              4-tab lifecycle, Form 16A upload, Form 26AS reconciliation.
            </Module>
            <Module icon="link" title="Banking + AA">
              CSV import for 7 banks, reconcile suggestions, Setu AA scaffold ready.
            </Module>
            <Module icon="users" title="Customer portal">
              Magic link auth, self-serve invoices, support tickets, subscriptions.
            </Module>
            <Module icon="whatsapp" title="WhatsApp + email">
              Gupshup BSP inbox, send-quote-as-PDF, Resend email integration.
            </Module>
            <Module icon="package" title="Procurement">
              Purchase orders, PO ↔ vendor bill matching, pre-fill wizard.
            </Module>
            <Module icon="award" title="Partner channel">
              Distributor → reseller hierarchy, partner catalog sync, cross-tenant mirror.
            </Module>
          </div>
        </div>
      </section>

      {/* ── Why us ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="mb-10 text-center">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Why pick ResellerOS over a generic CRM
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <ValueCard
            title="Built by a reseller"
            body="12+ years running Excel Technologies — a Mumbai-based GW/M365/Zoho reseller. Every workflow comes from real operational pain, not feature-list bingo."
          />
          <ValueCard
            title="GST-first by design"
            body="HSN 998313, CGST §31 invoice numbering, intra/inter-state tax split, advance receipts — built into the schema, not bolted on as plugins."
          />
          <ValueCard
            title="No drift from Excel Tech"
            body="Excel Technologies is our first customer. If a feature doesn&rsquo;t work for us in production, it doesn&rsquo;t ship. Zero theoretical features."
          />
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────── */}
      <section className="border-y border-hairline bg-amber-soft/20">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center sm:py-16">
          <Badge kind="warning" size="sm" dot className="mb-3">
            Beta pricing
          </Badge>
          <h2 className="mb-3 font-serif text-3xl tracking-tight sm:text-4xl">
            Free during beta.
          </h2>
          <p className="mb-1 text-base leading-relaxed text-ink-2">
            We&rsquo;re onboarding the first 10 paying resellers personally.
            <br className="hidden sm:inline" /> Starter / Growth / Pro tiers
            launch once we hit ₹15K MRR.
          </p>
          <p className="mt-4 font-mono text-xs text-ink-3">
            All features included · No seat limits · You decide when to start paying
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
        <h2 className="mb-4 font-serif text-3xl tracking-tight sm:text-4xl">
          Ready to leave the seven-tool circus?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-base text-ink-3">
          Create your tenant, import your existing customers via CSV, and run
          your first GST-compliant invoice in under 10 minutes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary" iconRight="arrow_right" size="lg">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Button asChild variant="default" size="lg">
            <Link href={"/about" as never}>Read the founder story</Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
          <div className="text-xs text-ink-3">
            <span className="font-mono">ResellerOS</span> · Excel Technologies Pvt Ltd · Mumbai
            <span className="mx-2">·</span>
            Made in India
          </div>
          <nav className="flex flex-wrap gap-5 text-xs text-ink-3">
            <Link href={"/about" as never}   className="hover:text-ink transition-colors">About</Link>
            <Link href={"/privacy" as never} className="hover:text-ink transition-colors">Privacy</Link>
            <Link href={"/terms" as never}   className="hover:text-ink transition-colors">Terms</Link>
            <a href="mailto:hello@resellersos.in" className="hover:text-ink transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/* ── Subcomponents (server, no client JS) ─────────────────────── */

function Module({
  icon,
  title,
  children,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-hairline bg-paper p-4 transition-shadow hover:shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-amber-soft text-amber-ink">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <h3 className="font-serif text-base tracking-tight">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink-3">{children}</p>
    </div>
  );
}

function ValueCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-hairline bg-paper-2/40 p-5">
      <h3 className="mb-2 font-serif text-lg tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}
