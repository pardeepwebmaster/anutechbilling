import type { Metadata } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

import "@/app/globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-serif",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ResellerOS — Reseller business, operated.",
    template: "%s · ResellerOS",
  },
  description:
    "The complete operating system for Indian cloud resellers. Sell Google Workspace, Microsoft 365, and Zoho with built-in GST invoicing, Razorpay payments, and Premier Partner escalation.",
  keywords: [
    "Google Workspace reseller",
    "cloud reseller SaaS India",
    "GST e-invoice",
    "Razorpay billing",
    "Premier Partner",
  ],
  authors: [{ name: "Excel Technologies Pvt Ltd" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "ResellerOS",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-paper text-ink antialiased",
          fontSans.variable,
          fontSerif.variable,
          fontMono.variable
        )}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
