/**
 * (app) layout — authenticated app shell with Sidebar + TopBar.
 * Wraps all internal app routes: /dashboard, /leads, /customers, etc.
 *
 * Mobile: sidebar collapses behind hamburger.
 * Desktop: 240px sidebar + main content.
 */
"use client";

import * as React from "react";
import { Sidebar, MobileSidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-paper-2/50">
      {/* Desktop sidebar (sticky 240px) */}
      <Sidebar />

      {/* Mobile sidebar (slide-in) */}
      <MobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMobileMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
