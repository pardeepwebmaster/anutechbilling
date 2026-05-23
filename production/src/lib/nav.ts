/**
 * Navigation config — single source of truth for sidebar + breadcrumbs.
 *
 * Adding a new screen?
 * 1. Add an entry to APP_NAV
 * 2. Add a breadcrumb to SCREEN_TITLES
 * 3. Create the page at src/app/(app)/[id]/page.tsx
 */

export interface NavItem {
  id: string;
  /** URL path (relative, starts with /) */
  href: string;
  label: string;
  /** Icon name from our Icon component */
  icon: string;
  /** Optional badge text (e.g., count of pending items) */
  badge?: string;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

// ============================================================
// Internal app nav (the main sidebar for resellers)
// ============================================================
export const APP_NAV: NavSection[] = [
  {
    section: "Workspace",
    items: [
      { id: "dashboard",  href: "/dashboard",  label: "Dashboard",     icon: "home" },
      // Lead Sources page kept at /lead-gen but removed from sidebar — its
      // recent-inbound-leads section duplicates Deal Pipeline → Leads tab,
      // and the channel/webhook config is premature for the typical v1
      // tenant (Excel Tech ships v1 with manual entry + WhatsApP, no embedded
      // forms or webhooks). Surface it back here once real acquisition
      // channels exist or move its config bits into Settings → Integrations.
      // { id: "lead-gen",   href: "/lead-gen",   label: "Lead Sources",  icon: "inbox" },
      { id: "leads",      href: "/leads",      label: "Deal Pipeline", icon: "target" },
      { id: "customers",  href: "/customers",  label: "Customers",     icon: "users" },
      { id: "contacts",   href: "/contacts",   label: "Contacts",      icon: "user" },
      { id: "items",      href: "/items",      label: "Items Catalog", icon: "package" },
    ],
  },
  {
    section: "Revenue",
    items: [
      { id: "online-orders", href: "/online-orders", label: "Online Orders", icon: "cart" },
      { id: "quotes",        href: "/quotes",        label: "Quotes",        icon: "file" },
      { id: "payments",      href: "/payments",      label: "Payments",      icon: "rupee" },
      { id: "invoices",      href: "/invoices",      label: "Invoices",      icon: "receipt" },
      { id: "subscriptions", href: "/subscriptions", label: "Subscriptions", icon: "refresh" },
      { id: "renewals",      href: "/renewals",      label: "Renewals",      icon: "clock" },
    ],
  },
  {
    section: "Engage",
    items: [
      { id: "whatsapp",    href: "/whatsapp",    label: "WhatsApp Inbox", icon: "whatsapp" },
      { id: "automations", href: "/automations", label: "Automations",    icon: "zap" },
      { id: "campaigns",   href: "/campaigns",   label: "Campaigns",      icon: "send" },
      { id: "reports",     href: "/reports",     label: "Reports",        icon: "chart" },
      { id: "support",     href: "/support",     label: "Support",        icon: "ticket" },
    ],
  },
  {
    section: "System",
    items: [
      { id: "setup",    href: "/setup",    label: "Setup Wizard",    icon: "rocket" },
      { id: "settings", href: "/settings", label: "Settings & Team", icon: "settings" },
      { id: "mobile",   href: "/mobile",   label: "Mobile (PWA)",    icon: "mobile" },
    ],
  },
];

// ============================================================
// Customer-facing pages (chromeless — used in nav switcher)
// ============================================================
export const CUSTOMER_NAV: NavSection[] = [
  {
    section: "Customer-facing",
    items: [
      { id: "landing",          href: "/",                  label: "Marketing Landing", icon: "globe" },
      { id: "buy-workspace",    href: "/buy/workspace",     label: "Buy · Workspace",   icon: "sparkles" },
      { id: "buy-m365",         href: "/buy/m365",          label: "Buy · Microsoft 365", icon: "package" },
      { id: "buy-zoho",         href: "/buy/zoho",          label: "Buy · Zoho",        icon: "package" },
      { id: "portal",           href: "/portal",            label: "Customer Portal",   icon: "layout" },
      { id: "quote-accept",     href: "/quote/Q-2026-0042", label: "Quote Accept & Pay", icon: "check_circle" },
      { id: "support-customer", href: "/support-customer",  label: "Customer Support",  icon: "question" },
    ],
  },
];

// ============================================================
// Breadcrumb titles — by URL path
// ============================================================
export const SCREEN_TITLES: Record<string, string[]> = {
  "/dashboard":       ["Workspace", "Dashboard"],
  "/lead-gen":        ["Workspace", "Lead Sources"],
  "/leads":           ["Workspace", "Deal Pipeline"],
  "/customers":       ["Workspace", "Customers"],
  "/contacts":        ["Workspace", "Contacts"],
  "/items":           ["Workspace", "Items Catalog"],
  "/online-orders":   ["Revenue", "Online Orders"],
  "/quotes":          ["Revenue", "Quotes"],
  "/quotes/new":      ["Revenue", "Quotes", "New"],
  "/payments":        ["Revenue", "Payments"],
  "/invoices":        ["Revenue", "Invoices"],
  "/subscriptions":   ["Revenue", "Subscriptions"],
  "/renewals":        ["Revenue", "Renewals"],
  "/whatsapp":        ["Engage", "WhatsApp Inbox"],
  "/automations":     ["Engage", "Automations"],
  "/campaigns":       ["Engage", "Campaigns"],
  "/reports":         ["Engage", "Reports"],
  "/support":         ["Engage", "Support"],
  "/setup":           ["System", "Setup Wizard"],
  "/settings":        ["System", "Settings & Team"],
  "/mobile":          ["System", "Mobile (PWA)"],
};

/**
 * Get breadcrumb path for a URL.
 * Falls back to ["Workspace", "Dashboard"] if no match.
 */
export function getCrumb(pathname: string): string[] {
  return SCREEN_TITLES[pathname] ?? ["Workspace", "Dashboard"];
}
