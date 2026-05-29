import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

/**
 * Public marketing landing page — visual v2.
 *
 * Built for cold prospects (Indian cloud resellers). All visuals are
 * CSS-only — no external images. Loads in <1s. Server-rendered.
 *
 * Design language matches production tokens (paper, ink, hairline,
 * amber, font-serif). Aesthetic: Linear / Resend / Vercel — editorial,
 * restrained, real screenshots over abstract gradients.
 *
 * If a visitor is already authenticated, kick them to /dashboard
 * (unless ?preview=1 is set — useful for demos).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: { preview?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && searchParams.preview !== "1") redirect("/dashboard");

  return (
    <main className="min-h-screen bg-paper text-ink antialiased">
      <TopNav />
      <Hero />
      <TrustRibbon />
      <PainSection />
      <ModuleShowcase />
      <WhyUs />
      <FounderSection />
      <BetaPricing />
      <FinalCta />
      <Footer />
    </main>
  );
}

/* ───────────────────────────────────────────────────────────────
   Top nav
   ─────────────────────────────────────────────────────────────── */

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-paper">
            <Icon name="layout" className="h-4 w-4" />
          </span>
          <span className="font-serif text-xl tracking-tight">ResellerOS</span>
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
  );
}

/* ───────────────────────────────────────────────────────────────
   Hero — headline + product mockup
   ─────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft warm radial backdrop — subtle amber wash, not loud */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px]"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(254, 215, 170, 0.45) 0%, rgba(250, 250, 249, 0) 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-6 pt-12 pb-6 sm:pt-20">
        {/* Headline column */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge kind="info" dot className="mb-5">
            For Indian cloud resellers
          </Badge>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            One OS for your reseller business.
            <br className="hidden sm:block" />
            <span className="text-ink-3">No more juggling seven tools.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
            ResellerOS handles leads, quotes, GST invoices, renewals, banking,
            and customer portal — purpose-built for Google Workspace, Microsoft 365,
            and Zoho resellers in India.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild variant="primary" iconRight="arrow_right" size="lg">
              <Link href="/signup">Start free trial</Link>
            </Button>
            <Button asChild variant="default" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            14-day trial · No credit card · ₹0 to get started
          </p>
        </div>

        {/* Product mockup */}
        <div className="mx-auto mt-14 max-w-5xl">
          <BrowserFrame title="resellersos.in · Dashboard">
            <DashboardMockup />
          </BrowserFrame>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Trust ribbon
   ─────────────────────────────────────────────────────────────── */

function TrustRibbon() {
  return (
    <section className="border-y border-hairline bg-paper-2/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-6 py-5 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        <span>🇮🇳 Built in Mumbai</span>
        <Dot />
        <span>GST + HSN 998313</span>
        <Dot />
        <span>DPDP Act 2023 ready</span>
        <Dot />
        <span>Hosted on Google Cloud Mumbai</span>
        <Dot />
        <span>Razorpay payouts</span>
      </div>
    </section>
  );
}

function Dot() {
  return <span aria-hidden className="hidden sm:inline text-ink-3/40">●</span>;
}

/* ───────────────────────────────────────────────────────────────
   Pain section — "If this sounds familiar"
   ─────────────────────────────────────────────────────────────── */

function PainSection() {
  const pains = [
    {
      icon: "inbox",
      title: "Lead chaos",
      body: "Spreadsheet for leads. WhatsApp for follow-ups. Memory for what was said.",
    },
    {
      icon: "receipt",
      title: "Quote → invoice friction",
      body: "Tally or Zoho Books for invoices. Re-typing customer details every quote.",
    },
    {
      icon: "link",
      title: "Bank + renewal slips",
      body: "Bank reconciliation on paper. Renewal reminders that get missed.",
    },
    {
      icon: "alert",
      title: "GST quarterly crisis",
      body: "Filings done at the eleventh hour. Margins that stay fuzzy.",
    },
  ] as const;

  return (
    <section className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <Badge kind="warning" size="sm" dot className="mb-3">
          If this sounds familiar
        </Badge>
        <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          You&rsquo;re running a reseller business
          <br className="hidden sm:block" /> across seven apps.
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pains.map((p) => (
          <div
            key={p.title}
            className="group relative overflow-hidden rounded-xl border border-hairline bg-paper p-5 transition-shadow hover:shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-rose/10 text-rose">
                <Icon name={p.icon as never} className="h-4 w-4" />
              </span>
              <h3 className="font-serif text-base tracking-tight">{p.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-2">{p.body}</p>
            {/* Decorative rose accent line */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-rose/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Module showcase — alternating image+text rows + compact grid
   ─────────────────────────────────────────────────────────────── */

function ModuleShowcase() {
  return (
    <section className="border-y border-hairline bg-paper-2/40">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Badge kind="success" size="sm" dot className="mb-3">
            What&rsquo;s inside
          </Badge>
          <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            17 modules. One database.
            <br className="hidden sm:block" /> Built to talk to each other.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-2">
            A lead becomes a quote becomes an invoice becomes a subscription
            becomes a renewal — with zero re-typing.
          </p>
        </div>

        {/* Detailed alternating rows */}
        <div className="space-y-16 sm:space-y-24">
          <ModuleRow
            badge="01 · Pipeline"
            title="From inbox to ₹ won, in one view."
            body="A unified pipeline replaces your spreadsheets. Smart Views chip the right deals to the top. Today Strip surfaces what needs follow-up before lunch."
            features={[
              "Lead → Deal split for sales workflow",
              "Kanban + list + smart filters",
              "Inline call / email / WhatsApp",
            ]}
            mockup={<KanbanMockup />}
          />
          <ModuleRow
            reverse
            badge="02 · Quotes"
            title="GST-compliant quotes in 90 seconds."
            body="5 commitment types × 2 pricing tiers, per-line discounts, prospect mode. CGST/SGST split is calculated, not handcrafted. Send as PDF + WhatsApp + email — auto-tracked."
            features={[
              "CGST §31 compliant numbering",
              "Multi-tier price catalog with wholesale",
              "Send + audit log + accept page",
            ]}
            mockup={<QuoteBuilderMockup />}
          />
          <ModuleRow
            badge="03 · Renewals"
            title="Renewals on autopilot, with grace."
            body="T-30, T-15, T-7, T-0 cadence. Reminder emails. Auto-suspend with grace window. Renewal quote drafted on day one — operator just clicks send."
            features={[
              "Auto-generated renewal quotes",
              "Configurable grace period per tenant",
              "Daily cron, idempotent + safe",
            ]}
            mockup={<RenewalTimelineMockup />}
          />
          <ModuleRow
            reverse
            badge="04 · Banking"
            title="Bank reconciliation that knows what 'Razorpay-2026-05' means."
            body="CSV import for HDFC, ICICI, SBI, Axis, Kotak, IndusInd, Yes Bank. Auto-match suggestions with confidence pills. Setu Account Aggregator ready for live fetch."
            features={[
              "7 bank parsers, period-suffix safe",
              "Exact / high / low match suggestions",
              "Manual reconcile escape hatch",
            ]}
            mockup={<BankingMockup />}
          />
        </div>

        {/* Compact grid for remaining modules */}
        <div className="mt-20">
          <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Plus 8 more modules
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CompactModule icon="cart"          title="Razorpay + buy pages"   body="Public checkout, coupons, site promos." />
            <CompactModule icon="chart"         title="Accounting layer"        body="P&L, aging, MRR/ARR/Churn/LTV." />
            <CompactModule icon="rupee"         title="TDS receivable"          body="Form 16A upload, 26AS reconcile." />
            <CompactModule icon="users"         title="Customer portal"         body="Magic-link, invoices, tickets." />
            <CompactModule icon="whatsapp"      title="WhatsApp + email"        body="Gupshup BSP, Resend, PDF send." />
            <CompactModule icon="package"       title="Procurement"             body="POs, PO ↔ bill matching." />
            <CompactModule icon="award"         title="Partner channel"         body="Distributor ↔ reseller sync." />
            <CompactModule icon="check_circle"  title="GSTIN verification"      body="Sandbox.co.in + auto-fill." />
          </div>
        </div>
      </div>
    </section>
  );
}

function ModuleRow({
  badge,
  title,
  body,
  features,
  mockup,
  reverse = false,
}: {
  badge: string;
  title: string;
  body: string;
  features: string[];
  mockup: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
      {/* Copy column */}
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-amber">
          {badge}
        </p>
        <h3 className="mb-3 font-serif text-2xl leading-tight tracking-tight sm:text-3xl">
          {title}
        </h3>
        <p className="mb-5 text-base leading-relaxed text-ink-2">{body}</p>
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink-2">
              <span className="mt-[5px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald/10 text-emerald">
                <Icon name="check" className="h-3 w-3" />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Mockup column */}
      <div>{mockup}</div>
    </div>
  );
}

function CompactModule({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-paper p-4 transition-shadow hover:shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-soft text-amber-ink">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <h4 className="font-serif text-sm tracking-tight">{title}</h4>
      </div>
      <p className="text-xs leading-relaxed text-ink-3">{body}</p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Why pick us — 3 cards with numeric badges
   ─────────────────────────────────────────────────────────────── */

function WhyUs() {
  const cards = [
    {
      num: "01",
      title: "Built by a reseller",
      body: "12+ years running Excel Technologies — a Mumbai-based GW/M365/Zoho reseller. Every workflow comes from real operational pain, not feature-list bingo.",
    },
    {
      num: "02",
      title: "GST-first by design",
      body: "HSN 998313, CGST §31 invoice numbering, intra/inter-state tax split, advance receipts — built into the schema, not bolted on as plugins.",
    },
    {
      num: "03",
      title: "No drift from Excel Tech",
      body: "Excel Technologies is our first customer. If a feature doesn't work for us in production, it doesn't ship. Zero theoretical features.",
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
      <div className="mb-12 text-center">
        <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          Why pick ResellerOS over a generic CRM
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.num}
            className="relative rounded-xl border border-hairline bg-paper p-6 transition-shadow hover:shadow-sm"
          >
            <span className="absolute right-5 top-5 font-serif text-2xl text-ink-3/60">
              {c.num}
            </span>
            <h3 className="mb-2 max-w-[80%] font-serif text-lg leading-tight tracking-tight">
              {c.title}
            </h3>
            <p className="text-sm leading-relaxed text-ink-2">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Founder section — editorial pull quote
   ─────────────────────────────────────────────────────────────── */

function FounderSection() {
  return (
    <section className="border-y border-hairline bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Quote column */}
          <div>
            <Icon name="sparkles" className="mb-4 h-5 w-5 text-amber" />
            <blockquote className="font-serif text-3xl leading-[1.15] tracking-tight text-ink sm:text-4xl">
              &ldquo;I built the OS I wished I&rsquo;d had on day one.&rdquo;
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px w-10 bg-ink-3/40" />
              <div>
                <p className="font-medium text-ink">Pardeep A</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                  Founder · Excel Technologies · Mumbai
                </p>
              </div>
            </div>
          </div>

          {/* Founder card column */}
          <div className="rounded-xl border border-hairline bg-paper-2/40 p-6 sm:p-8">
            <div className="mb-5 flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-amber-soft font-serif text-xl text-amber-ink">
                PA
              </div>
              <div>
                <p className="font-medium text-ink">Pardeep A</p>
                <p className="text-sm text-ink-3">
                  12+ years as a Google Workspace, M365 &amp; Zoho reseller
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-ink-2">
              Built ResellerOS from the real constraints of operating his own
              business — payments missed, renewals slipped, GST filings done at
              the eleventh hour. Now sharing the tool with other resellers
              instead of keeping it inside Excel Tech.
            </p>
            <Link
              href={"/about" as never}
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-amber hover:text-amber-ink"
            >
              Read the full story
              <Icon name="arrow_right" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Beta pricing
   ─────────────────────────────────────────────────────────────── */

function BetaPricing() {
  return (
    <section className="relative overflow-hidden border-b border-hairline">
      {/* Soft amber wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 50%, rgba(254, 215, 170, 0.35) 0%, rgba(250, 250, 249, 0) 70%)",
        }}
      />
      <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
        <Badge kind="warning" size="sm" dot className="mb-3">
          Beta pricing
        </Badge>
        <h2 className="mb-3 font-serif text-3xl leading-tight tracking-tight sm:text-5xl">
          Free during beta.
        </h2>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-ink-2">
          We&rsquo;re onboarding the first 10 paying resellers personally.
          Starter / Growth / Pro tiers launch once we hit ₹15K MRR.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          <span>All features included</span>
          <Dot />
          <span>No seat limits</span>
          <Dot />
          <span>You decide when to start paying</span>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Final CTA
   ─────────────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
      <h2 className="mb-4 font-serif text-3xl leading-tight tracking-tight sm:text-5xl">
        Ready to leave the
        <br className="hidden sm:block" /> seven-tool circus?
      </h2>
      <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-ink-2">
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
  );
}

/* ───────────────────────────────────────────────────────────────
   Footer
   ─────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-hairline bg-paper-2/40">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-ink text-paper">
              <Icon name="layout" className="h-3.5 w-3.5" />
            </span>
            <span className="font-serif text-base tracking-tight">ResellerOS</span>
          </div>
          <nav className="flex flex-wrap gap-5 text-sm text-ink-2">
            <Link href={"/about" as never}   className="hover:text-ink transition-colors">About</Link>
            <Link href={"/privacy" as never} className="hover:text-ink transition-colors">Privacy</Link>
            <Link href={"/terms" as never}   className="hover:text-ink transition-colors">Terms</Link>
            <a href="mailto:hello@resellersos.in" className="hover:text-ink transition-colors">
              Contact
            </a>
          </nav>
        </div>
        <div className="mt-8 border-t border-hairline pt-6 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          Excel Technologies Pvt Ltd · Mumbai, India · Made with care for Indian resellers
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CSS-only mockups
   ═══════════════════════════════════════════════════════════════ */

function BrowserFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper shadow-[0_30px_80px_-30px_rgba(28,25,23,0.18)]">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-hairline bg-paper-2/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald/40" />
        <div className="ml-3 flex-1 truncate rounded border border-hairline bg-paper px-3 py-1 text-center font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {title}
        </div>
        <div className="hidden gap-1 sm:flex">
          <span className="h-1 w-1 rounded-full bg-ink-3/40" />
          <span className="h-1 w-1 rounded-full bg-ink-3/40" />
          <span className="h-1 w-1 rounded-full bg-ink-3/40" />
        </div>
      </div>
      {/* Content */}
      <div className="bg-paper">{children}</div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="flex min-h-[420px]">
      {/* Sidebar */}
      <aside className="hidden w-[180px] shrink-0 border-r border-hairline bg-paper-2/40 p-3 sm:block">
        <div className="mb-4 px-2 font-mono text-[9px] uppercase tracking-wider text-ink-3">
          Excel Tech
        </div>
        <SidebarItem icon="home"    label="Dashboard" active />
        <SidebarItem icon="target"  label="Leads"     badge="3" />
        <SidebarItem icon="file"    label="Quotes"    badge="2" />
        <SidebarItem icon="receipt" label="Invoices" />
        <SidebarItem icon="refresh" label="Renewals" />
        <SidebarItem icon="link"    label="Banking" />
        <div className="my-3 border-t border-hairline" />
        <SidebarItem icon="package" label="Catalog" />
        <SidebarItem icon="users"   label="Customers" />
        <SidebarItem icon="chart"   label="Reports" />
      </aside>

      {/* Main */}
      <div className="flex-1 p-5 sm:p-6">
        {/* Breadcrumb */}
        <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-ink-3">
          Friday, 29 May 2026
        </p>
        <h4 className="mb-4 font-serif text-lg tracking-tight">
          Good morning, Pardeep.
        </h4>

        {/* KPI strip */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiTile label="MRR"        value="₹69.4K"  hint="4 active subs" />
          <KpiTile label="Pipeline"   value="₹96.3K"  hint="1 active deal" />
          <KpiTile label="Accepted"   value="₹6.3L"   hint="MTD · 4 quotes" />
          <KpiTile label="Renewals"   value="0"       hint="Next 30 days" />
        </div>

        {/* Quote table */}
        <div className="rounded-lg border border-hairline bg-paper">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Icon name="file" className="h-3.5 w-3.5 text-ink-3" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                Recent quotes
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber">
              View all →
            </span>
          </div>
          <table className="w-full">
            <tbody>
              <QuoteRow id="Q-2026-27-0005" who="Manoj"        plan="GW Starter"  amount="₹2.4L"  status="sent" />
              <QuoteRow id="Q-2026-27-0004" who="sunil loza"   plan="M365 Biz"    amount="₹28.9K" status="accepted" />
              <QuoteRow id="Q-2026-27-0003" who="TechVista"    plan="GW Business" amount="₹6.3L"  status="paid" />
              <QuoteRow id="Q-2026-27-0002" who="Excel"        plan="Zoho One"    amount="₹54K"   status="draft" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  badge,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
        active ? "bg-paper text-ink shadow-[0_1px_2px_rgba(28,25,23,0.06)]" : "text-ink-2"
      }`}
    >
      <Icon name={icon} className={`h-3.5 w-3.5 ${active ? "text-amber" : "text-ink-3"}`} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="rounded-full bg-amber-soft px-1.5 py-px font-mono text-[9px] text-amber-ink">
          {badge}
        </span>
      )}
    </div>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-paper p-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-0.5 font-serif text-lg leading-tight tracking-tight">{value}</p>
      <p className="text-[10px] text-ink-3">{hint}</p>
    </div>
  );
}

function QuoteRow({
  id,
  who,
  plan,
  amount,
  status,
}: {
  id: string;
  who: string;
  plan: string;
  amount: string;
  status: "draft" | "sent" | "accepted" | "paid";
}) {
  const statusStyle: Record<typeof status, string> = {
    draft:    "bg-ink-3/10 text-ink-3",
    sent:     "bg-indigo/10 text-indigo",
    accepted: "bg-amber-soft text-amber-ink",
    paid:     "bg-emerald/10 text-emerald",
  };
  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="px-4 py-2.5 font-mono text-[10px] text-ink-3">{id}</td>
      <td className="px-2 py-2.5 text-xs text-ink">{who}</td>
      <td className="hidden px-2 py-2.5 text-[11px] text-ink-2 sm:table-cell">{plan}</td>
      <td className="px-2 py-2.5 text-right font-serif text-sm tracking-tight text-ink">
        {amount}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className={`inline-block rounded-full px-2 py-px font-mono text-[9px] uppercase tracking-wider ${statusStyle[status]}`}>
          {status}
        </span>
      </td>
    </tr>
  );
}

/* ── Module mockups ────────────────────────────────────────────── */

function KanbanMockup() {
  const cols = [
    { name: "New",        items: [["Acme Corp", "₹84K"], ["BrightHR",  "₹54K"]] },
    { name: "Contacted",  items: [["DataCo",    "₹1.2L"]] },
    { name: "Quote Sent", items: [["TechVista", "₹2.4L"], ["GreenLeaf", "₹96K"]] },
    { name: "Won",        items: [["Manoj",     "₹6.3L"]] },
  ];

  return (
    <BrowserFrame title="resellersos.in/leads · Kanban">
      <div className="grid grid-cols-4 gap-2 bg-paper-2/40 p-3">
        {cols.map((c) => (
          <div key={c.name}>
            <div className="mb-2 flex items-center justify-between px-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-3">
                {c.name}
              </span>
              <span className="font-mono text-[9px] text-ink-3">
                {c.items.length}
              </span>
            </div>
            <div className="space-y-2">
              {c.items.map(([co, amt]) => (
                <div key={co} className="rounded-md border border-hairline bg-paper p-2">
                  <p className="text-[11px] font-medium text-ink">{co}</p>
                  <p className="mt-0.5 font-serif text-xs tracking-tight text-amber">{amt}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function QuoteBuilderMockup() {
  return (
    <BrowserFrame title="resellersos.in/quotes/new · Builder">
      <div className="p-4">
        {/* Customer row */}
        <div className="mb-3 flex items-center justify-between rounded-md border border-hairline bg-paper-2/40 px-3 py-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-3">Customer</p>
            <p className="text-xs font-medium text-ink">TechVista Pvt Ltd</p>
          </div>
          <span className="font-mono text-[9px] text-ink-3">GST 27AAACT1234A1Z5</span>
        </div>

        {/* Line items */}
        <div className="rounded-md border border-hairline">
          <div className="border-b border-hairline bg-paper-2/40 px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-3">
              Line items
            </span>
          </div>
          <table className="w-full">
            <tbody>
              <LineItem name="Google Workspace Business Plus" qty={50} rate="₹2,016" total="₹1,00,800" />
              <LineItem name="Microsoft 365 Business Premium" qty={20} rate="₹1,800" total="₹36,000" />
              <LineItem name="Zoho One Enterprise"            qty={10} rate="₹2,400" total="₹24,000" />
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-3 rounded-md border border-hairline bg-paper-2/40 p-3">
          <div className="space-y-1 text-[11px]">
            <TotalRow label="Subtotal"        value="₹1,60,800" />
            <TotalRow label="CGST · 9%"       value="₹14,472" />
            <TotalRow label="SGST · 9%"       value="₹14,472" />
            <div className="my-1.5 border-t border-hairline" />
            <TotalRow label="Total · INR" value="₹1,89,744" big />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-3 flex justify-end gap-2">
          <span className="rounded-md border border-hairline bg-paper px-3 py-1 font-mono text-[10px] text-ink-2">
            Save draft
          </span>
          <span className="rounded-md bg-amber px-3 py-1 font-mono text-[10px] text-paper">
            Send via email →
          </span>
        </div>
      </div>
    </BrowserFrame>
  );
}

function LineItem({
  name,
  qty,
  rate,
  total,
}: {
  name: string;
  qty: number;
  rate: string;
  total: string;
}) {
  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="px-3 py-2 text-[11px] text-ink">{name}</td>
      <td className="px-2 py-2 text-right font-mono text-[10px] text-ink-3">{qty}</td>
      <td className="hidden px-2 py-2 text-right font-mono text-[10px] text-ink-2 sm:table-cell">{rate}/mo</td>
      <td className="px-3 py-2 text-right font-serif text-xs tracking-tight text-ink">{total}</td>
    </tr>
  );
}

function TotalRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={big ? "font-medium text-ink" : "text-ink-2"}>{label}</span>
      <span className={`tracking-tight ${big ? "font-serif text-base text-ink" : "font-mono text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

function RenewalTimelineMockup() {
  const steps = [
    { label: "T-30", desc: "Heads-up email",   active: false },
    { label: "T-15", desc: "Renewal quote",    active: true },
    { label: "T-7",  desc: "Final reminder",   active: false },
    { label: "T-0",  desc: "Suspend + grace",  active: false },
  ];
  return (
    <BrowserFrame title="resellersos.in/renewals · Cadence">
      <div className="p-5">
        <div className="mb-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-ink-3">
            Subscription · TechVista · GW Starter × 50
          </p>
          <p className="mt-0.5 font-serif text-sm tracking-tight text-ink">
            Renewal · 14 Jun 2026
          </p>
        </div>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-0 right-0 top-3 h-px bg-hairline" />
          {/* Steps */}
          <div className="relative grid grid-cols-4 gap-2">
            {steps.map((s) => (
              <div key={s.label} className="text-center">
                <span
                  className={`mx-auto grid h-6 w-6 place-items-center rounded-full border-2 ${
                    s.active
                      ? "border-amber bg-amber text-paper"
                      : "border-hairline bg-paper text-ink-3"
                  } font-mono text-[9px]`}
                >
                  {s.active ? "•" : ""}
                </span>
                <p
                  className={`mt-2 font-mono text-[9px] uppercase tracking-wider ${
                    s.active ? "text-amber" : "text-ink-3"
                  }`}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-[10px] text-ink-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="mt-6 rounded-md border border-hairline bg-paper-2/40 p-3">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-3">
            Today · Cron 03:00 IST
          </p>
          <p className="text-[11px] text-ink-2">
            Renewal quote <span className="font-mono text-ink">Q-2026-27-0006</span> drafted
            · email queued · operator notification sent
          </p>
        </div>
      </div>
    </BrowserFrame>
  );
}

function BankingMockup() {
  const txns = [
    { date: "27 May", desc: "RTGS RAZORPAY-2026-05 · TechVista",   amount: "+₹2,40,000", match: "exact",  matchLabel: "Q-2026-27-0003" },
    { date: "26 May", desc: "NEFT MANOJ ENTERPRISES",              amount: "+₹54,000",   match: "high",   matchLabel: "Q-2026-27-0005" },
    { date: "25 May", desc: "UPI@HDFCBANK · Cred",                 amount: "-₹4,250",    match: "none",   matchLabel: "Unmatched" },
    { date: "24 May", desc: "GOOGLE INDIA · GSTIN 29AA...",        amount: "-₹84,000",   match: "low",    matchLabel: "Likely vendor bill" },
  ] as const;
  return (
    <BrowserFrame title="resellersos.in/banking · HDFC Current">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-3">
              HDFC Current · 50100***1234
            </p>
            <p className="mt-0.5 font-serif text-lg tracking-tight text-ink">₹8,14,250</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-3">Last sync</p>
            <p className="font-mono text-[10px] text-ink-2">28 May, 11:42</p>
          </div>
        </div>

        <div className="rounded-md border border-hairline">
          <div className="grid grid-cols-[60px_1fr_100px_90px] gap-2 border-b border-hairline bg-paper-2/40 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-3">
            <span>Date</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Match</span>
          </div>
          {txns.map((t) => (
            <div
              key={t.desc}
              className="grid grid-cols-[60px_1fr_100px_90px] gap-2 border-b border-hairline px-3 py-2 last:border-0"
            >
              <span className="font-mono text-[10px] text-ink-3">{t.date}</span>
              <span className="truncate text-[11px] text-ink">{t.desc}</span>
              <span
                className={`text-right font-serif text-xs tracking-tight ${
                  t.amount.startsWith("+") ? "text-emerald" : "text-rose"
                }`}
              >
                {t.amount}
              </span>
              <span className="flex justify-end">
                <MatchPill kind={t.match} label={t.matchLabel} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function MatchPill({
  kind,
  label,
}: {
  kind: "exact" | "high" | "low" | "none";
  label: string;
}) {
  const cls: Record<typeof kind, string> = {
    exact: "bg-emerald/10 text-emerald",
    high:  "bg-amber-soft text-amber-ink",
    low:   "bg-indigo/10 text-indigo",
    none:  "bg-ink-3/10 text-ink-3",
  };
  return (
    <span
      className={`inline-block max-w-full truncate rounded-full px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${cls[kind]}`}
    >
      {label}
    </span>
  );
}
