/**
 * Navigation config — single source of truth for sidebar + breadcrumbs.
 *
 * Adding a new screen?
 * 1. Add an entry to APP_NAV
 * 2. Add a breadcrumb to SCREEN_TITLES
 * 3. Create the page at src/app/(app)/[id]/page.tsx
 */

export type UserRole = "owner" | "manager" | "sales";

export interface NavItem {
  id: string;
  /** URL path (relative, starts with /) */
  href: string;
  label: string;
  /** Icon name from our Icon component */
  icon: string;
  /** Optional badge text (e.g., count of pending items) */
  badge?: string;
  /**
   * Roles that can see this nav item. Omit = visible to everyone (default).
   * Use to lock down sales-only or owner-only entries. Filtered in Sidebar.tsx.
   */
  roles?: UserRole[];
  /** Sub-links rendered as an accordion under this item (e.g. Reports → sub-reports). */
  children?: NavItem[];
}

export interface NavSection {
  section: string;
  items: NavItem[];
  /** Roles that can see this section. Omit = visible to everyone. */
  roles?: UserRole[];
}

/**
 * Filter nav sections + items by the caller's role + optional permission
 * flags (currently just `canViewDeals` for sales). Sections whose every
 * item is filtered out are dropped. Used by Sidebar to render a
 * role-appropriate menu.
 */
export interface NavFilterOpts {
  /** Sales-role extension: when true, the /deals entry stays visible. */
  canViewDeals?: boolean;
}
export function filterNavForRole(
  nav: NavSection[],
  role: UserRole | undefined,
  opts: NavFilterOpts = {},
): NavSection[] {
  if (!role) return nav;
  return nav
    .filter((s) => !s.roles || s.roles.includes(role))
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        // Sales-role specific: /deals hidden unless can_view_deals = true.
        if (role === "sales" && i.id === "deals" && !opts.canViewDeals) return false;
        return !i.roles || i.roles.includes(role);
      }),
    }))
    .filter((s) => s.items.length > 0);
}

/**
 * The set of routes a given role + permission set is allowed to visit.
 * Anything outside this set is redirected to ROLE_HOME[role] by middleware.
 */
export function allowedRoutesForRole(role: UserRole, opts: NavFilterOpts = {}): string[] {
  return filterNavForRole(APP_NAV, role, opts).flatMap((s) => s.items.map((i) => i.href));
}

/** Where each role lands by default (after login + on disallowed-route redirect). */
export const ROLE_HOME: Record<UserRole, string> = {
  owner:   "/dashboard",
  manager: "/dashboard",
  sales:   "/leads",
};

// ============================================================
// Internal app nav (the main sidebar for resellers)
// ============================================================
// Role conventions (applied to APP_NAV entries below):
//   • Items without an explicit `roles` list → visible to owner + manager.
//   • Sales-only users see ONLY the items explicitly tagged with "sales".
//   • Lead Pipeline + Tasks include "sales" because that's the day-to-day
//     surface for lead-only sellers (per Darshan's role at Excel Tech).
export const APP_NAV: NavSection[] = [
  {
    section: "Workspace",
    items: [
      { id: "dashboard",  href: "/dashboard",  label: "Dashboard",     icon: "home",    roles: ["owner", "manager"] },
      // Lead inbox — raw inquiries. Sales always sees this; deals page is a
      // separate entry below (gated by can_view_deals for sales).
      { id: "leads",      href: "/leads",      label: "Leads",         icon: "inbox",   roles: ["owner", "manager", "sales"] },
      // Inbound-email triage inbox. Feeds Leads (genuine enquiries auto-convert;
      // the rest are triaged by hand here), so it sits right after Leads.
      { id: "enquiries",  href: "/enquiries",  label: "Enquiries",     icon: "mail",    roles: ["owner", "manager", "sales"] },
      { id: "deals",      href: "/deals",      label: "Deal Pipeline", icon: "target",  roles: ["owner", "manager", "sales"] },
      { id: "tasks",      href: "/tasks",      label: "Tasks",         icon: "clock",   roles: ["owner", "manager", "sales"] },
      { id: "customers",  href: "/customers",  label: "Customers",     icon: "users",   roles: ["owner", "manager"] },
      { id: "contacts",   href: "/contacts",   label: "Contacts",      icon: "user",    roles: ["owner", "manager"] },
      { id: "items",      href: "/items",      label: "Items Catalog", icon: "package", roles: ["owner", "manager"] },
    ],
  },
  {
    // Section visible to sales too, but only the Quotes item is exposed to them
    // (sending quotes is a sales rep's core job). The money/admin items below
    // stay owner/manager-only via per-item roles.
    section: "Revenue",
    roles: ["owner", "manager", "sales"],
    items: [
      { id: "online-orders", href: "/online-orders", label: "Online Orders", icon: "cart",    roles: ["owner", "manager"] },
      { id: "quotes",        href: "/quotes",        label: "Quotes",        icon: "file",    roles: ["owner", "manager", "sales"] },
      { id: "payments",      href: "/payments",      label: "Payments",      icon: "rupee",   roles: ["owner", "manager"] },
      { id: "invoices",      href: "/invoices",      label: "Invoices",      icon: "receipt", roles: ["owner", "manager"] },
      { id: "subscriptions", href: "/subscriptions", label: "Subscriptions", icon: "refresh", roles: ["owner", "manager"] },
      { id: "renewals",      href: "/renewals",      label: "Renewals",      icon: "clock",   roles: ["owner", "manager"] },
    ],
  },
  {
    section: "Procurement",
    roles: ["owner", "manager"],
    items: [
      { id: "purchase-orders", href: "/purchase-orders", label: "Purchase Orders", icon: "cart" },
    ],
  },
  {
    section: "Accounting",
    roles: ["owner", "manager"],
    items: [
      { id: "saas-metrics",  href: "/accounting/saas-metrics",  label: "SaaS Metrics",       icon: "sparkles" },
      { id: "banking",       href: "/accounting/banking",       label: "Banking",            icon: "rupee" },
      { id: "bills",         href: "/accounting/bills",         label: "Vendor Bills",       icon: "receipt" },
      { id: "expenses",      href: "/accounting/expenses",      label: "Expenses",           icon: "rupee" },
      { id: "pnl",           href: "/accounting/pnl",           label: "P&L Report",         icon: "trending_up" },
      { id: "balance-sheet", href: "/accounting/balance-sheet", label: "Balance Sheet",      icon: "layout" },
      { id: "profitability", href: "/accounting/profitability", label: "Customer Margin",    icon: "users" },
      { id: "aging",         href: "/accounting/aging",         label: "Customer Aging",     icon: "clock" },
      { id: "tds-receivable", href: "/accounting/tds-receivable", label: "TDS Receivable",   icon: "rupee" },
      { id: "employee-loans", href: "/accounting/loans",        label: "Employee Loans",     icon: "users" },
      { id: "payroll",        href: "/accounting/payroll",      label: "Payroll & Leave",    icon: "users" },
      { id: "gst-summary",   href: "/accounting/gst",           label: "GST Reports",        icon: "file" },
    ],
  },
  {
    section: "Engage",
    roles: ["owner", "manager"],
    items: [
      { id: "whatsapp",    href: "/whatsapp",    label: "WhatsApp Inbox", icon: "whatsapp" },
      { id: "automations", href: "/automations", label: "Automations",    icon: "zap" },
      { id: "campaigns",     href: "/campaigns",     label: "Campaigns",     icon: "send" },
      { id: "online-promos", href: "/online-promos", label: "Online Promos", icon: "zap" },
      { id: "coupons",       href: "/coupons",       label: "Coupons",       icon: "rupee" },
      { id: "reports",       href: "/reports",       label: "Reports",       icon: "chart",
        children: [
          { id: "reports-profit",   href: "/reports/profit",          label: "Profit by product/service", icon: "package" },
          { id: "reports-customer", href: "/accounting/profitability", label: "Profit by customer",        icon: "users" },
        ],
      },
      { id: "support",     href: "/support",     label: "Support",        icon: "ticket" },
    ],
  },
  {
    section: "System",
    roles: ["owner", "manager"],
    items: [
      { id: "setup",    href: "/setup",    label: "Setup Wizard",    icon: "rocket" },
      { id: "settings", href: "/settings", label: "Settings",        icon: "settings" },
      { id: "team",     href: "/team",     label: "Team",            icon: "users" },
      // Partners page is for distributor-tier tenants only. Sidebar
      // shows the entry for everyone (low cost) — page itself gates
      // behind tier check and shows an explainer for non-distributors.
      { id: "partners", href: "/partners", label: "Partners",        icon: "link" },
      // Lead Sources lives here (System) — not Workspace — because it's
      // configuration-shaped: webhook URLs, form embed code, channel KPIs.
      // Set once / glanced at occasionally, not daily-use. When acquisition
      // matures (3+ live channels), consider promoting back to Workspace.
      { id: "lead-gen", href: "/lead-gen", label: "Lead Sources",    icon: "inbox" },
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
// NB: /leads + /deals share the same component (the /deals route file
//     re-exports from /leads). The titles still need separate entries here.
export const SCREEN_TITLES: Record<string, string[]> = {
  "/dashboard":       ["Workspace", "Dashboard"],
  "/lead-gen":        ["Workspace", "Lead Sources"],
  "/leads":           ["Workspace", "Leads"],
  "/enquiries":       ["Workspace", "Enquiries"],
  "/deals":           ["Workspace", "Deal Pipeline"],
  "/tasks":           ["Workspace", "Tasks"],
  "/customers":       ["Workspace", "Customers"],
  "/customers/[id]":  ["Workspace", "Customers", "Profile"],
  "/contacts":        ["Workspace", "Contacts"],
  "/items":           ["Workspace", "Items Catalog"],
  "/online-orders":   ["Revenue", "Online Orders"],
  "/quotes":          ["Revenue", "Quotes"],
  "/quotes/new":      ["Revenue", "Quotes", "New"],
  "/quotes/[id]":     ["Revenue", "Quotes", "Detail"],
  "/payments":        ["Revenue", "Payments"],
  "/invoices":        ["Revenue", "Invoices"],
  "/invoices/[id]":   ["Revenue", "Invoices", "Detail"],
  "/subscriptions":   ["Revenue", "Subscriptions"],
  "/renewals":        ["Revenue", "Renewals"],
  "/purchase-orders": ["Procurement", "Purchase Orders"],
  "/accounting/saas-metrics":  ["Accounting", "SaaS Metrics"],
  "/accounting/banking":       ["Accounting", "Banking"],
  "/accounting/banking/[id]":  ["Accounting", "Banking", "Account"],
  "/accounting/bills":         ["Accounting", "Vendor Bills"],
  "/accounting/expenses":      ["Accounting", "Expenses"],
  "/accounting/pnl":           ["Accounting", "P&L Report"],
  "/accounting/balance-sheet": ["Accounting", "Balance Sheet"],
  "/accounting/loans":         ["Accounting", "Employee Loans"],
  "/accounting/payroll":       ["Accounting", "Payroll & Leave"],
  "/accounting/profitability": ["Accounting", "Customer Margin"],
  "/accounting/aging":         ["Accounting", "Customer Aging"],
  "/accounting/tds-receivable":          ["Accounting", "TDS Receivable"],
  "/accounting/tds-receivable/year-end": ["Accounting", "TDS Receivable", "Year-End"],
  "/accounting/gst":      ["Accounting", "GST Reports"],
  "/accounting/gst/output":  ["Accounting", "GST", "Output (Sales)"],
  "/accounting/gst/input":   ["Accounting", "GST", "Input (Bills)"],
  "/accounting/gst/summary": ["Accounting", "GST", "Summary"],
  "/whatsapp":        ["Engage", "WhatsApp Inbox"],
  "/automations":     ["Engage", "Automations"],
  "/campaigns":       ["Engage", "Campaigns"],
  "/online-promos":   ["Engage", "Online Promos"],
  "/coupons":         ["Engage", "Coupons"],

  "/reports":         ["Engage", "Reports"],
  "/reports/profit":  ["Engage", "Reports", "Profit by product/service"],
  "/support":         ["Engage", "Support"],
  "/setup":           ["System", "Setup Wizard"],
  "/settings":        ["System", "Settings"],
  "/team":            ["System", "Team"],
  "/partners":        ["System", "Partners"],
  "/mobile":          ["System", "Mobile (PWA)"],
};

/**
 * Get breadcrumb path for a URL.
 * Falls back to ["Workspace", "Dashboard"] if no match.
 */
export function getCrumb(pathname: string): string[] {
  if (SCREEN_TITLES[pathname]) return SCREEN_TITLES[pathname];
  // Dynamic detail route (e.g. /customers/<uuid>, /quotes/Q-ET-…, /accounting/banking/<id>):
  // exact match fails, so walk up to the longest known parent — try the `[id]`
  // placeholder first (nicer 3-level crumb), then the bare section path. This
  // keeps the section correct instead of wrongly falling back to "Dashboard".
  const segs = pathname.split("/").filter(Boolean);
  for (let i = segs.length - 1; i >= 1; i--) {
    const prefix = "/" + segs.slice(0, i).join("/");
    if (SCREEN_TITLES[`${prefix}/[id]`]) return SCREEN_TITLES[`${prefix}/[id]`];
    if (SCREEN_TITLES[prefix]) return SCREEN_TITLES[prefix];
  }
  return ["Workspace", "Dashboard"];
}

/**
 * Get the primary destination for a section name, so a breadcrumb like
 * `Workspace / Dashboard` can wrap "Workspace" in a Link → /dashboard.
 *
 * Returns the first nav item's href in that section. If no match (the label
 * isn't a known section name — e.g., a sub-page label like "Year-End"),
 * returns null and the caller renders plain text.
 */
export function getSectionPrimaryHref(sectionName: string): string | null {
  const section = APP_NAV.find((s) => s.section === sectionName);
  if (!section || section.items.length === 0) return null;
  return section.items[0].href;
}
