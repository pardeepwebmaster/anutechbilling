import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Public marketing landing page.
 *
 * If the visitor is already authenticated, we kick them to /dashboard
 * — no point making them re-click "Sign in" every time.
 */
export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="max-w-2xl text-center">
        <Badge kind="info" dot className="mb-6">
          For Indian cloud resellers
        </Badge>

        <h1 className="font-serif text-5xl md:text-6xl leading-tight mb-4 tracking-tight">
          ResellerOS
        </h1>

        <p className="text-lg text-ink-3 mb-2 leading-relaxed">
          The complete operating system for cloud resellers.
        </p>
        <p className="text-base text-ink-3 mb-10 leading-relaxed">
          Leads, quotes, GST invoices, renewals, and customer portal — one
          place, built for Google Workspace, Microsoft 365, and Zoho resellers.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Button asChild variant="primary" iconRight="arrow_right">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="default">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <Feature
            title="Lead → Renewal"
            body="One pipeline from inbound enquiry to year-3 renewal. No more juggling spreadsheets."
          />
          <Feature
            title="GST-first"
            body="CGST §31 compliant tax invoices, receipt vouchers, credit notes — generated, not handcrafted."
          />
          <Feature
            title="Renewal automation"
            body="T-15 to grace period — reminders, quotes, and suspension happen on autopilot."
          />
        </div>

        <div className="mt-16 text-xs text-ink-3 font-mono">
          Made in India · Excel Technologies Pvt Ltd
        </div>
      </div>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-4 rounded-lg border border-hairline bg-paper-2">
      <div className="font-serif text-lg mb-1">{title}</div>
      <p className="text-sm text-ink-3 leading-relaxed">{body}</p>
    </div>
  );
}
