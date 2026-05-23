/**
 * (auth) layout — centered, chromeless layout for login + signup.
 */
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-2/50 flex flex-col">
      {/* Top bar with brand */}
      <header className="flex items-center justify-between p-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-ink text-paper grid place-items-center font-serif text-lg">R</div>
          <div className="text-sm font-semibold">ResellerOS</div>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="p-6 text-center text-xs text-ink-3">
        © {new Date().getFullYear()} ResellerOS · DPDP Act compliant
      </footer>
    </div>
  );
}
