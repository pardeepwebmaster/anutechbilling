/**
 * Pricing — public marketing page.
 *
 * Honest positioning during beta: free for first 10 paying resellers,
 * tier structure shown for transparency about what's coming. Prices
 * are aspirational targets aligned with the 90-day plan (₹15K MRR at
 * 10 customers = ~₹1,500/customer/month average).
 *
 * No paywall switches enabled in product yet — tier names + features
 * here are forward-looking. Update PROJECT_TRACKER + this page together
 * when we launch real billing.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { PublicTopBar, PublicFooter } from "../_components/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "Pricing — ResellerOS",
  description:
    "Free during beta. Starter / Growth / Pro tiers launch once we hit ₹15K MRR. All features included today.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <PublicTopBar />
      <main>
        <Hero />
        <BetaBanner />
        <TierCards />
        <Comparison />
        <FAQ />
        <CTA />
      </main>
      <PublicFooter />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Hero
   ─────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="mx-auto max-w-3xl px-6 pt-16 pb-8 text-center sm:pt-20">
      <Badge kind="info" dot className="mb-5">
        Pricing
      </Badge>
      <h1 className="font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
        Simple pricing.
        <br className="hidden sm:block" />
        <span className="text-ink-3">Built for Indian SME budgets.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
        Three tiers, all in INR. No per-seat gotchas, no surprise renewals,
        no enterprise sales calls. What you see is what you pay.
      </p>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Beta banner — honest "free for now" positioning
   ─────────────────────────────────────────────────────────────── */

function BetaBanner() {
  return (
    <section className="mx-auto max-w-3xl px-6">
      <div className="rounded-xl border border-amber/30 bg-amber-soft/30 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber text-paper">
            <Icon name="sparkles" className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-amber-ink">
              Beta · until 2026-09-01 or 10 paying customers
            </p>
            <h2 className="mb-2 font-serif text-xl tracking-tight text-ink sm:text-2xl">
              Free for the first 10 resellers. Personally onboarded.
            </h2>
            <p className="text-sm leading-relaxed text-ink-2">
              All features below are unlocked. You decide when to start paying —
              once you&rsquo;ve invoiced your first customer through ResellerOS,
              we&rsquo;ll talk pricing. If the tool doesn&rsquo;t pay for itself
              in 30 days, you don&rsquo;t.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Tier cards
   ─────────────────────────────────────────────────────────────── */

const TIERS = [
  {
    name: "Starter",
    audience: "Solo reseller or small team",
    monthly: 999,
    yearly: 9_990, // 2 months free
    accent: "indigo",
    features: [
      "1 user",
      "Up to 50 customers",
      "Unlimited leads + quotes",
      "GST-compliant invoicing (HSN 998313)",
      "Customer portal (magic link)",
      "WhatsApp single-line inbox",
      "CSV bank statement import",
      "Email support · 48-hour response",
    ],
    cta: "Start free trial",
    href: "/signup",
  },
  {
    name: "Growth",
    audience: "Growing reseller, 2-10 employees",
    monthly: 2_499,
    yearly: 24_990,
    accent: "amber",
    badge: "Most popular",
    features: [
      "Up to 5 users with role-based access",
      "Up to 500 customers",
      "Renewal automation (T-30 / T-15 / T-7 / T-0)",
      "Razorpay live mode + auto-receipt",
      "WhatsApp Business inbox (Gupshup BSP)",
      "Advanced reports (MRR, churn, aging)",
      "TDS receivable + Form 26AS",
      "Setu Account Aggregator (live bank sync)",
      "Email + WhatsApp support · 12-hour response",
    ],
    cta: "Start free trial",
    href: "/signup",
  },
  {
    name: "Pro",
    audience: "Distributor or 10+ employee reseller",
    monthly: 6_999,
    yearly: 69_990,
    accent: "ink",
    features: [
      "Unlimited users",
      "Unlimited customers",
      "Partner channel (distributor → reseller)",
      "Cross-tenant invoice → vendor bill mirror",
      "Custom domain for customer portal",
      "White-label PDF (your logo, your colors)",
      "Custom integrations (Tally, Zoho Books)",
      "Dedicated WhatsApp + Slack support · 4-hour response",
      "Quarterly review with the founder",
    ],
    cta: "Talk to sales",
    href: "mailto:hello@resellersos.in?subject=ResellerOS%20Pro%20enquiry",
  },
] as const;

function TierCards() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {TIERS.map((t) => (
          <TierCard key={t.name} tier={t} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-ink-3">
        All prices in ₹ (INR), exclusive of 18% GST. Yearly billing saves 2 months.
      </p>
    </section>
  );
}

function TierCard({ tier }: { tier: (typeof TIERS)[number] }) {
  const isPopular = "badge" in tier && tier.badge;
  const monthlyPrice = tier.monthly.toLocaleString("en-IN");
  const yearlyMonthly = Math.round(tier.yearly / 12).toLocaleString("en-IN");

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-paper p-6 sm:p-7 ${
        isPopular
          ? "border-amber/50 shadow-[0_30px_80px_-30px_rgba(194,65,12,0.25)]"
          : "border-hairline"
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-paper">
          {tier.badge}
        </span>
      )}

      <div className="mb-1">
        <h3 className="font-serif text-2xl tracking-tight text-ink">
          {tier.name}
        </h3>
        <p className="text-sm text-ink-3">{tier.audience}</p>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-4xl tracking-tight text-ink">
            ₹{monthlyPrice}
          </span>
          <span className="text-sm text-ink-3">/ month</span>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          Or ₹{yearlyMonthly}/mo billed yearly · save 2 months
        </p>
      </div>

      <ul className="my-6 space-y-2.5 border-t border-hairline pt-5 text-sm text-ink-2">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-[5px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald/10 text-emerald">
              <Icon name="check" className="h-3 w-3" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <Button asChild variant={isPopular ? "primary" : "default"} className="w-full" iconRight={isPopular ? "arrow_right" : undefined}>
          {tier.href.startsWith("mailto:") ? (
            <a href={tier.href}>{tier.cta}</a>
          ) : (
            <Link href={tier.href}>{tier.cta}</Link>
          )}
        </Button>
        <p className="mt-2 text-center text-[11px] text-ink-3">
          {tier.name === "Pro" ? "Reply within 24 hours" : "14-day trial · No credit card"}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Feature comparison table
   ─────────────────────────────────────────────────────────────── */

const COMPARISON: Array<{
  group: string;
  rows: Array<{ feature: string; starter: string | boolean; growth: string | boolean; pro: string | boolean }>;
}> = [
  {
    group: "Limits",
    rows: [
      { feature: "Users",     starter: "1",        growth: "Up to 5", pro: "Unlimited" },
      { feature: "Customers", starter: "Up to 50", growth: "Up to 500", pro: "Unlimited" },
      { feature: "Quotes / mo", starter: "Unlimited", growth: "Unlimited", pro: "Unlimited" },
    ],
  },
  {
    group: "Core CRM",
    rows: [
      { feature: "Leads + Deal pipeline",   starter: true, growth: true, pro: true },
      { feature: "Quote builder (5 tiers)", starter: true, growth: true, pro: true },
      { feature: "GST invoices (HSN 998313)", starter: true, growth: true, pro: true },
      { feature: "Customer portal",         starter: true, growth: true, pro: true },
      { feature: "Smart Views + Kanban",    starter: true, growth: true, pro: true },
    ],
  },
  {
    group: "Automation",
    rows: [
      { feature: "Renewal cadence (T-30 → T-0)", starter: false, growth: true, pro: true },
      { feature: "Auto-suspend with grace",      starter: false, growth: true, pro: true },
      { feature: "WhatsApp Business inbox",      starter: "Single line", growth: true, pro: true },
      { feature: "Razorpay live mode",           starter: false, growth: true, pro: true },
      { feature: "Setu Account Aggregator",      starter: false, growth: true, pro: true },
    ],
  },
  {
    group: "Reports",
    rows: [
      { feature: "P&L + Customer Aging",   starter: true, growth: true, pro: true },
      { feature: "MRR / ARR / Churn / LTV", starter: false, growth: true, pro: true },
      { feature: "TDS receivable + 26AS", starter: false, growth: true, pro: true },
      { feature: "Per-customer profitability", starter: false, growth: true, pro: true },
    ],
  },
  {
    group: "Distributor features",
    rows: [
      { feature: "Partner channel (distributor → reseller)", starter: false, growth: false, pro: true },
      { feature: "Cross-tenant invoice mirror", starter: false, growth: false, pro: true },
      { feature: "Partner catalog sync", starter: false, growth: false, pro: true },
    ],
  },
  {
    group: "Branding + Support",
    rows: [
      { feature: "White-label PDFs",          starter: false, growth: false, pro: true },
      { feature: "Custom portal domain",      starter: false, growth: false, pro: true },
      { feature: "Custom integrations",       starter: false, growth: false, pro: "Tally + Zoho Books" },
      { feature: "Support response time",     starter: "48 hours · email", growth: "12 hours · email + WhatsApp", pro: "4 hours · WhatsApp + Slack" },
      { feature: "Quarterly founder review",  starter: false, growth: false, pro: true },
    ],
  },
];

function Comparison() {
  return (
    <section className="border-y border-hairline bg-paper-2/40">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="mb-10 text-center">
          <Badge kind="success" size="sm" dot className="mb-3">
            Full comparison
          </Badge>
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Every feature, side by side.
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-hairline">
                <th className="py-3 pr-4 text-left font-mono text-[10px] uppercase tracking-wider text-ink-3"></th>
                {TIERS.map((t) => (
                  <th
                    key={t.name}
                    className="py-3 px-3 text-center font-serif text-base text-ink"
                  >
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((group) => (
                <ComparisonGroup key={group.group} group={group} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ComparisonGroup({
  group,
}: {
  group: (typeof COMPARISON)[number];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="pt-6 pb-2 font-mono text-[10px] uppercase tracking-wider text-amber"
        >
          {group.group}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.feature} className="border-b border-hairline/60">
          <td className="py-2.5 pr-4 text-sm text-ink-2">{row.feature}</td>
          <ComparisonCell value={row.starter} />
          <ComparisonCell value={row.growth} />
          <ComparisonCell value={row.pro} />
        </tr>
      ))}
    </>
  );
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <td className="px-3 py-2.5 text-center">
        <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-emerald/10 text-emerald">
          <Icon name="check" className="h-3.5 w-3.5" />
        </span>
      </td>
    );
  }
  if (value === false) {
    return (
      <td className="px-3 py-2.5 text-center text-ink-3/40">—</td>
    );
  }
  return (
    <td className="px-3 py-2.5 text-center font-mono text-[11px] text-ink-2">
      {value}
    </td>
  );
}

/* ───────────────────────────────────────────────────────────────
   FAQ
   ─────────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: "When does the beta pricing end?",
    a: "When we hit 10 paying customers or 1 September 2026, whichever comes first. After that, beta tenants stay on a grandfathered discount for 12 months.",
  },
  {
    q: "Why is Starter only 1 user?",
    a: "Most solo resellers run their entire business themselves. If you have 2 people sharing one login, that&rsquo;s fine — but we built role-based access (Growth tier) for teams who need clean audit trails.",
  },
  {
    q: "Do you offer monthly billing?",
    a: "Yes, all tiers can be paid monthly or yearly. Yearly saves you 2 months. You can switch between monthly and yearly at any time.",
  },
  {
    q: "What payment methods do you accept?",
    a: "UPI, Net Banking, all major credit/debit cards, and corporate cheques (Pro tier). Payouts via Razorpay so your invoice is GST-compliant for ITC claim.",
  },
  {
    q: "Can I import data from Tally / Zoho Books / Excel?",
    a: "Yes. CSV import is available for customers, contacts, and leads on all tiers. Live Tally + Zoho Books sync is included on Pro tier; we&rsquo;ll quote bespoke for Starter / Growth if you need it.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep access until the end of the billing cycle, then your tenant goes read-only for 90 days (download anything you need). After that, data is permanently deleted per our DPDP Act 2023 retention policy.",
  },
  {
    q: "Do you have a free forever plan?",
    a: "No — and we won&rsquo;t. We&rsquo;d rather give every paying customer real support than juggle a free tier we can&rsquo;t serve well. 14-day trial covers most evaluation needs.",
  },
  {
    q: "Is my data secure?",
    a: "Postgres with row-level security (you only see your tenant&rsquo;s data). Daily backups. Hosted on Google Cloud Mumbai (asia-south1) for India data residency. DPDP Act 2023 compliant. See our privacy policy for details.",
  },
];

function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <div className="mb-10 text-center">
        <Badge kind="info" size="sm" dot className="mb-3">
          Common questions
        </Badge>
        <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
          The honest answers.
        </h2>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-lg border border-hairline bg-paper px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-serif text-base tracking-tight text-ink">
              <span>{item.q}</span>
              <Icon
                name="chevron_down"
                className="mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180"
              />
            </summary>
            <p
              className="mt-3 text-sm leading-relaxed text-ink-2"
              dangerouslySetInnerHTML={{ __html: item.a }}
            />
          </details>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-ink-3">
        More questions?{" "}
        <a
          href="mailto:hello@resellersos.in"
          className="font-medium text-amber hover:text-amber-ink"
        >
          hello@resellersos.in
        </a>{" "}
        — we reply within a day, usually faster.
      </p>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Final CTA
   ─────────────────────────────────────────────────────────────── */

function CTA() {
  return (
    <section className="border-t border-hairline bg-paper-2/30">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
        <h2 className="mb-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          Try it free for 14 days.
        </h2>
        <p className="mx-auto mb-7 max-w-xl text-base leading-relaxed text-ink-2">
          No credit card. No sales call. Bring your existing leads via CSV and run
          a GST-compliant invoice in under 10 minutes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary" iconRight="arrow_right" size="lg">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Button asChild variant="default" size="lg">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
