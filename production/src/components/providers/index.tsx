/**
 * Providers — single wrapper for all top-level providers.
 * Mount once in root layout.
 */
"use client";

import { ThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
