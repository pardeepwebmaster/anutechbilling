/**
 * Customer Portal layout — shared chrome for /portal/* pages.
 * Lightweight nav. Reseller branding (Excel Tech for v1).
 */
import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-2/40 flex flex-col">
      <header className="border-b border-hairline bg-paper">
        <div className="max-w-[1080px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-ink text-paper rounded-md grid place-items-center font-serif text-lg">
              R
            </div>
            <div>
              <div className="font-serif text-base leading-none">Excel Technologies</div>
              <div className="text-[10px] text-ink-3 mt-1">Customer Portal</div>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-sm text-ink-3">
            <Link href="/portal/dashboard"    className="hover:text-ink">Dashboard</Link>
            <Link href="/portal/subscription" className="hover:text-ink">Subscription</Link>
            <Link href="/portal/orders"       className="hover:text-ink">Orders</Link>
            <Link href="/portal/invoices"     className="hover:text-ink">Invoices</Link>
            <Link href="/portal/support"      className="hover:text-ink">Support</Link>
            <Link href="/portal/profile"      className="hover:text-ink">Profile</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-hairline bg-paper py-6 text-center text-xs text-ink-3">
        Excel Technologies Pvt Ltd · Google Premier Partner since 2014 · GSTIN registered
      </footer>
    </div>
  );
}
