/**
 * QueryProvider — wraps TanStack Query for client-side data fetching.
 *
 * Sensible defaults:
 * - staleTime: 30 seconds (avoid refetches on every navigation)
 * - retry: 1 attempt on failure
 * - refetchOnWindowFocus: disabled (annoying for SaaS apps)
 */
"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Single QueryClient instance per render — created lazily inside the component
  // so we don't share data between SSR requests.
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
