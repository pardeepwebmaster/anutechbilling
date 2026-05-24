/**
 * Online Orders — matches prototype screen "online-orders".
 *
 * Admin view for incoming orders from the buy-workspace-v2 page (paid + trial).
 * Shows real-time provisioning pipeline: new → provisioning → DNS pending → active.
 *
 * NOTE: Order data is currently mock/demo. When buy-workspace-v2 is live,
 * replace ONLINE_ORDERS with a Supabase query on an `orders` table.
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { GeminiCard } from "@/components/shared/gemini-card";
import { EmptyState } from "@/components/shared/empty-state";
import { KPI } from "@/components/shared/kpi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { TabBar, type TabBarItem } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { rupee } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "provisioning"
  | "dns-pending"
  | "active"
  | "issue"
  | "trial-active"
  | "trial-converting"
  | "trial-expired";

type ProgressState = "done" | "active" | "pending" | "failed";

interface Order {
  id:          string;
  type:        "paid" | "trial";
  createdAt:   string;
  company:     string;
  domain:      string;
  gstin:       string | null;
  contact:     { name: string; email: string; phone: string };
  tier:        string;
  seats:       number;
  billing:     "annual" | "monthly" | null;
  monthlyRate: number;
  lineTotal:   number | null;
  gst:         number | null;
  total:       number | null;
  trialDay:    number | null;
  trialEndsOn: string | null;
  razorpayId:  string | null;
  invoiceNo:   string | null;
  status:      OrderStatus;
  source:      string;
  progress:    Record<string, ProgressState>;
  amAssigned:  string;
  nextAction:  string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// Replace with Supabase `orders` table query once buy flow is live.

const ONLINE_ORDERS: Order[] = [
  {
    id: "ORD-2026-0089", type: "paid", createdAt: "20 May · 09:42 AM",
    company: "Acme Corp Pvt Ltd", domain: "acmecorp.com", gstin: "27AAACA1234B1Z5",
    contact: { name: "Rajesh Kumar", email: "rajesh@acmecorp.com", phone: "+91 98765 43210" },
    tier: "Business Standard", seats: 25, billing: "annual",
    monthlyRate: 864, lineTotal: 259200, gst: 46656, total: 305856,
    trialDay: null, trialEndsOn: null,
    razorpayId: "pay_NMxAbc7891", invoiceNo: "INV-2026-0156",
    status: "provisioning", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "active", users: "pending", dns: "pending", welcome: "pending" },
    amAssigned: "Pardeep A", nextAction: "Tenant creation in progress · ETA 3 min",
  },
  {
    id: "ORD-2026-0088", type: "paid", createdAt: "20 May · 08:14 AM",
    company: "Echo Pharma Ltd", domain: "echopharma.in", gstin: "27AABCE5678D1Z2",
    contact: { name: "Dr. Verma", email: "drverma@echopharma.in", phone: "+91 98201 22233" },
    tier: "Business Plus", seats: 60, billing: "annual",
    monthlyRate: 1380, lineTotal: 993600, gst: 178848, total: 1172448,
    trialDay: null, trialEndsOn: null,
    razorpayId: "pay_NMxDef4521", invoiceNo: "INV-2026-0155",
    status: "dns-pending", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "done", users: "done", dns: "active", welcome: "pending" },
    amAssigned: "Pardeep A", nextAction: "Waiting on customer to add MX records · sent guide 2h ago",
  },
  {
    id: "ORD-2026-0087", type: "paid", createdAt: "19 May · 11:38 PM",
    company: "Foxtrot Logistics", domain: "foxtrotlog.com", gstin: "29AABCF9999K1Z0",
    contact: { name: "Anil Sharma", email: "anil@foxtrotlog.com", phone: "+91 99800 12345" },
    tier: "Business Starter", seats: 8, billing: "annual",
    monthlyRate: 270, lineTotal: 25920, gst: 4666, total: 30586,
    trialDay: null, trialEndsOn: null,
    razorpayId: "pay_NMxGhi7733", invoiceNo: "INV-2026-0154",
    status: "active", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "done", users: "done", dns: "done", welcome: "done" },
    amAssigned: "Anjali R", nextAction: "Live · health-check email scheduled for Day 7",
  },
  {
    id: "ORD-2026-0086", type: "paid", createdAt: "19 May · 04:11 PM",
    company: "Hotel Asia Mumbai", domain: "hotelasia.in", gstin: "27AAAAH2345R2Z9",
    contact: { name: "Sunita Patel", email: "sunita@hotelasia.in", phone: "+91 97694 88112" },
    tier: "Business Standard", seats: 40, billing: "annual",
    monthlyRate: 864, lineTotal: 414720, gst: 74650, total: 489370,
    trialDay: null, trialEndsOn: null,
    razorpayId: "pay_NMxJkl2210", invoiceNo: "INV-2026-0153",
    status: "issue", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "failed", users: "pending", dns: "pending", welcome: "pending" },
    amAssigned: "Pardeep A", nextAction: "⚠ Domain already exists in another tenant — needs manual resolution",
  },
  {
    id: "TRL-2026-0042", type: "trial", createdAt: "20 May · 11:15 AM",
    company: "Beta Industries Pvt Ltd", domain: "betaind.in", gstin: null,
    contact: { name: "Priya Menon", email: "priya@betaind.in", phone: "+91 98765 11111" },
    tier: "Business Starter", seats: 15, billing: null,
    monthlyRate: 270, lineTotal: null, gst: null, total: null,
    trialDay: 1, trialEndsOn: "03 Jun 2026",
    razorpayId: null, invoiceNo: null,
    status: "trial-active", source: "buy-workspace-v2",
    progress: { signup: "done", domainVerify: "done", tenant: "done", welcome: "done", day3CheckIn: "pending", day10Convert: "pending" },
    amAssigned: "Pardeep A", nextAction: "Call within 2 hours · then Day 3 check-in",
  },
  {
    id: "TRL-2026-0041", type: "trial", createdAt: "17 May · 02:30 PM",
    company: "Delta Foods Pvt Ltd", domain: "deltafoods.co.in", gstin: null,
    contact: { name: "Karthik N", email: "karthik@deltafoods.co.in", phone: "+91 90400 55667" },
    tier: "Business Standard", seats: 22, billing: null,
    monthlyRate: 864, lineTotal: null, gst: null, total: null,
    trialDay: 4, trialEndsOn: "31 May 2026",
    razorpayId: null, invoiceNo: null,
    status: "trial-active", source: "buy-workspace-v2",
    progress: { signup: "done", domainVerify: "done", tenant: "done", welcome: "done", day3CheckIn: "done", day10Convert: "pending" },
    amAssigned: "Anjali R", nextAction: "Migration call scheduled for tomorrow 4 PM",
  },
  {
    id: "TRL-2026-0040", type: "trial", createdAt: "10 May · 09:00 AM",
    company: "Cosmo Tech Solutions", domain: "cosmotech.in", gstin: null,
    contact: { name: "Vikram J", email: "vikram@cosmotech.in", phone: "+91 88600 12345" },
    tier: "Business Standard", seats: 18, billing: null,
    monthlyRate: 864, lineTotal: null, gst: null, total: null,
    trialDay: 11, trialEndsOn: "24 May 2026",
    razorpayId: null, invoiceNo: null,
    status: "trial-converting", source: "buy-workspace-v2",
    progress: { signup: "done", domainVerify: "done", tenant: "done", welcome: "done", day3CheckIn: "done", day10Convert: "active" },
    amAssigned: "Pardeep A", nextAction: "Quote sent · awaiting Razorpay payment",
  },
  {
    id: "TRL-2026-0039", type: "trial", createdAt: "06 May · 11:20 AM",
    company: "Gamma Realty", domain: "gammarealty.com", gstin: null,
    contact: { name: "Mehul P", email: "mehul@gammarealty.com", phone: "+91 96200 99887" },
    tier: "Business Starter", seats: 6, billing: null,
    monthlyRate: 270, lineTotal: null, gst: null, total: null,
    trialDay: 15, trialEndsOn: "20 May 2026",
    razorpayId: null, invoiceNo: null,
    status: "trial-expired", source: "buy-workspace-v2",
    progress: { signup: "done", domainVerify: "done", tenant: "done", welcome: "done", day3CheckIn: "done", day10Convert: "done" },
    amAssigned: "Anjali R", nextAction: "Did not convert · tenant suspended · send winback email",
  },
  {
    id: "ORD-2026-0085", type: "paid", createdAt: "18 May · 10:00 AM",
    company: "Indigo Travels Ltd", domain: "indigotravels.co.in", gstin: "27AABCI3344L1Z5",
    contact: { name: "Rohan S", email: "rohan@indigotravels.co.in", phone: "+91 99800 77665" },
    tier: "Business Standard", seats: 32, billing: "annual",
    monthlyRate: 864, lineTotal: 331776, gst: 59720, total: 391496,
    trialDay: null, trialEndsOn: null,
    razorpayId: "pay_NMxOpq3344", invoiceNo: "INV-2026-0152",
    status: "active", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "done", users: "done", dns: "done", welcome: "done" },
    amAssigned: "Pardeep A", nextAction: "Live · NPS survey scheduled for Day 30",
  },
];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; kind: "warning" | "info" | "success" | "danger" | "muted"; icon: string }> = {
  "provisioning":     { label: "Provisioning",       kind: "warning", icon: "refresh" },
  "dns-pending":      { label: "DNS pending",         kind: "info",    icon: "clock"   },
  "active":           { label: "Active",              kind: "success", icon: "check_circle" },
  "issue":            { label: "Issue",               kind: "danger",  icon: "alert"   },
  "trial-active":     { label: "Trial · active",      kind: "info",    icon: "rocket"  },
  "trial-converting": { label: "Trial · converting",  kind: "warning", icon: "refresh" },
  "trial-expired":    { label: "Trial · expired",     kind: "muted",   icon: "x_circle" },
};

const PAID_STEPS = [
  { key: "payment",  label: "Payment",       icon: "rupee"   },
  { key: "invoice",  label: "GST Invoice",   icon: "receipt" },
  { key: "tenant",   label: "Tenant",        icon: "globe"   },
  { key: "users",    label: "Users created", icon: "users"   },
  { key: "dns",      label: "DNS verified",  icon: "shield"  },
  { key: "welcome",  label: "Welcome email", icon: "mail"    },
];

const TRIAL_STEPS = [
  { key: "signup",       label: "Signup",         icon: "check"   },
  { key: "domainVerify", label: "Domain verify",  icon: "globe"   },
  { key: "tenant",       label: "Trial tenant",   icon: "rocket"  },
  { key: "welcome",      label: "Welcome email",  icon: "mail"    },
  { key: "day3CheckIn",  label: "Day 3 check-in", icon: "clock"   },
  { key: "day10Convert", label: "Day 10 convert", icon: "rupee"   },
];

// ─── Progress step ────────────────────────────────────────────────────────────

function ProgressStep({
  icon,
  label,
  state,
}: {
  icon: string;
  label: string;
  state: ProgressState;
}) {
  const cfg: Record<ProgressState, { colorCls: string; bgCls: string; statusLabel: string }> = {
    done:    { colorCls: "text-emerald-600", bgCls: "bg-emerald-50", statusLabel: "Completed"  },
    active:  { colorCls: "text-amber",       bgCls: "bg-amber-50",   statusLabel: "Running…"   },
    pending: { colorCls: "text-ink-3",       bgCls: "bg-paper-2",    statusLabel: "Pending"    },
    failed:  { colorCls: "text-rose-600",    bgCls: "bg-rose-50",    statusLabel: "Failed — needs attention" },
  };
  const c = cfg[state];
  return (
    <div className={cn("flex items-center gap-3 rounded-lg p-2.5", c.bgCls)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper">
        <Icon name={icon} size={14} className={c.colorCls} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className={cn("text-xs font-medium", c.colorCls)}>{c.statusLabel}</p>
      </div>
    </div>
  );
}

// ─── Order detail drawer ──────────────────────────────────────────────────────

function OrderDetailDrawer({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const isPaid = order.type === "paid";
  const steps  = isPaid ? PAID_STEPS : TRIAL_STEPS;
  const s      = STATUS_META[order.status];

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[520px] flex flex-col p-0">
        <SheetHeader className="border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2 mb-0.5">
            <SheetTitle className="font-serif text-lg leading-tight">
              {order.id}
            </SheetTitle>
            <Badge kind={s.kind} dot>{s.label}</Badge>
          </div>
          <p className="text-xs text-ink-3">
            {order.company} · {order.createdAt}
          </p>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Customer */}
          <DrawerSection title="Customer">
            {[
              { label: "Company",  value: order.company,       mono: false },
              { label: "Domain",   value: order.domain,        mono: true  },
              ...(order.gstin ? [{ label: "GSTIN", value: order.gstin, mono: true }] : []),
              { label: "Contact",  value: order.contact.name,  mono: false },
              { label: "Email",    value: order.contact.email, mono: true  },
              { label: "Phone",    value: order.contact.phone, mono: true  },
            ].map((r) => (
              <DrawerRow key={r.label} label={r.label} mono={r.mono}>
                {r.value}
              </DrawerRow>
            ))}
          </DrawerSection>

          {/* Order / Trial */}
          <DrawerSection title={isPaid ? "Order" : "Trial"}>
            <DrawerRow label="Plan">{order.tier}</DrawerRow>
            <DrawerRow label="Seats">{order.seats}</DrawerRow>
            {isPaid ? (
              <>
                <DrawerRow label="Billing">
                  {order.billing === "annual" ? "Annual" : "Monthly"}
                </DrawerRow>
                <DrawerRow label="Rate/seat">{rupee(order.monthlyRate)}/month</DrawerRow>
                <DrawerRow label="Line total">{rupee(order.lineTotal)}</DrawerRow>
                <DrawerRow label="GST (18%)">{rupee(order.gst)}</DrawerRow>
                <DrawerRow label="Total">
                  <span className="font-semibold text-amber">{rupee(order.total)}</span>
                </DrawerRow>
                <DrawerRow label="Razorpay ID" mono>{order.razorpayId}</DrawerRow>
                <DrawerRow label="Invoice" mono>{order.invoiceNo}</DrawerRow>
              </>
            ) : (
              <>
                <DrawerRow label="Day">
                  <strong>Day {order.trialDay} of 14</strong>
                </DrawerRow>
                <DrawerRow label="Expires">{order.trialEndsOn}</DrawerRow>
              </>
            )}
            <DrawerRow label="Source" mono>{order.source}</DrawerRow>
            <DrawerRow label="Assigned to">{order.amAssigned}</DrawerRow>
          </DrawerSection>

          {/* Automation progress */}
          <DrawerSection title="Automation progress">
            <div className="space-y-2">
              {steps.map((step) => (
                <ProgressStep
                  key={step.key}
                  icon={step.icon}
                  label={step.label}
                  state={(order.progress[step.key] as ProgressState) ?? "pending"}
                />
              ))}
            </div>
          </DrawerSection>

          {/* Next action */}
          <DrawerSection title="Next action">
            <div
              className={cn(
                "flex gap-2.5 rounded-lg border p-3 text-sm text-ink",
                order.status === "issue"
                  ? "border-rose-200 bg-rose-50"
                  : "border-amber-200 bg-amber-50",
              )}
            >
              <Icon
                name={order.status === "issue" ? "alert" : "info"}
                size={14}
                className={cn(
                  "mt-0.5 shrink-0",
                  order.status === "issue" ? "text-rose-600" : "text-amber",
                )}
              />
              <p>{order.nextAction}</p>
            </div>
          </DrawerSection>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 border-t border-hairline bg-paper-2 px-6 py-3">
          {isPaid && order.status === "provisioning" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => toast.info("Re-running provisioning…")}
            >
              <Icon name="refresh" size={12} />
              Retry provisioning
            </Button>
          )}
          {isPaid && order.status === "dns-pending" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => toast.success("DNS guide re-sent")}
            >
              <Icon name="mail" size={12} />
              Re-send DNS guide
            </Button>
          )}
          {isPaid && order.status === "issue" && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => toast.info("Escalating to Google support…")}
            >
              <Icon name="alert" size={12} />
              Escalate to Google
            </Button>
          )}
          {!isPaid &&
            order.status === "trial-active" &&
            (order.trialDay ?? 0) >= 7 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => toast.success("Conversion quote sent")}
              >
                <Icon name="rupee" size={12} />
                Send convert quote
              </Button>
            )}
          {!isPaid &&
            order.status === "trial-active" &&
            (order.trialDay ?? 0) < 7 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => toast.success("Call logged")}
              >
                <Icon name="phone" size={12} />
                Log AM call
              </Button>
            )}
          {!isPaid && order.status === "trial-expired" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => toast.success("Winback email queued")}
            >
              <Icon name="mail" size={12} />
              Send winback
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={() => toast.info(`WhatsApp: ${order.contact.name}`)}
          >
            <Icon name="whatsapp" size={12} />
            WhatsApp
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => toast.info(`Calling ${order.contact.phone}`)}
          >
            <Icon name="phone" size={12} />
            Call
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => toast.info(`Email: ${order.contact.email}`)}
          >
            <Icon name="mail" size={12} />
            Email
          </Button>
          {isPaid && (
            <Button
              variant="default"
              size="sm"
              onClick={() => toast.info("Downloading invoice PDF…")}
            >
              <Icon name="download" size={12} />
              Invoice
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.info("Opening Google Admin Console")}
          >
            <Icon name="external" size={12} />
            Admin console
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Small drawer helpers
function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-3">
        {title}
      </p>
      {children}
    </div>
  );
}

function DrawerRow({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid items-center gap-3 border-b border-hairline/50 py-1.5 text-sm last:border-0"
      style={{ gridTemplateColumns: "120px 1fr" }}
    >
      <span className="text-ink-3">{label}</span>
      <span className={cn("text-ink", mono && "font-mono text-xs")}>{children}</span>
    </div>
  );
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnlineOrdersPage() {
  const [tab, setTab]       = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const openOrder = ONLINE_ORDERS.find((o) => o.id === openId) ?? null;

  // Filtered list
  const filtered = ONLINE_ORDERS.filter((o) => {
    if (tab === "paid"   && o.type !== "paid")    return false;
    if (tab === "trial"  && o.type !== "trial")   return false;
    if (tab === "issues" && o.status !== "issue") return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !o.company.toLowerCase().includes(q) &&
        !o.id.toLowerCase().includes(q) &&
        !o.contact.email.toLowerCase().includes(q) &&
        !o.domain.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // KPI stats
  const today      = ONLINE_ORDERS.filter((o) => o.createdAt.includes("20 May")).length;
  const provis     = ONLINE_ORDERS.filter((o) => o.status === "provisioning").length;
  const issues     = ONLINE_ORDERS.filter((o) => o.status === "issue").length;
  const trialEx    = ONLINE_ORDERS.filter(
    (o) => o.type === "trial" && (o.trialDay ?? 0) >= 11 && o.status === "trial-active",
  ).length;
  const revenueMtd = ONLINE_ORDERS.filter((o) => o.type === "paid").reduce(
    (s, o) => s + (o.total ?? 0),
    0,
  );

  const tabItems: TabBarItem[] = [
    { id: "all",    label: `All · ${ONLINE_ORDERS.length}` },
    { id: "paid",   label: `Paid · ${ONLINE_ORDERS.filter((o) => o.type === "paid").length}` },
    { id: "trial",  label: `Trials · ${ONLINE_ORDERS.filter((o) => o.type === "trial").length}` },
    { id: "issues", label: `Issues · ${issues}` },
  ];

  return (
    <div className="mx-auto max-w-screen-xl px-8 pb-20 pt-7">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">Online Orders</h1>
          <p className="mt-1 text-sm text-ink-3">
            Live pipeline from <strong>buy-workspace-v2</strong> · Paid + Trial ·{" "}
            {ONLINE_ORDERS.length} total
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => toast.success("Refreshed")}
          >
            <Icon name="refresh" size={14} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => toast.info("Exporting CSV…")}
          >
            <Icon name="download" size={14} />
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => toast.info("Opening automation rules")}
          >
            <Icon name="settings" size={14} />
            Automation rules
          </Button>
        </div>
      </div>

      {/* ── Gemini AI ── */}
      <div className="mb-6">
        <GeminiCard
          title="Orders AI · Today's focus"
          compact
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => toast.info("Escalating Hotel Asia issue to Google support")}
              >
                <Icon name="alert" size={12} />
                Fix Hotel Asia issue
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => toast.info("Calling Beta Industries — new trial")}
              >
                <Icon name="phone" size={12} />
                Welcome call to Beta
              </Button>
            </div>
          }
        >
          <strong className="text-ink">
            {issues} blocker · {trialEx} conversion opportunity.
          </strong>{" "}
          Hotel Asia provisioning is stuck (domain conflict) — fix to unblock ₹4.9L revenue. Cosmo Tech is on Day 11 of trial with high engagement — perfect time to send convert quote. Beta Industries just signed up — first call within 2 hours is your conversion edge.
        </GeminiCard>
      </div>

      {/* ── KPIs ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KPI
          label="New today"
          value={today}
          trend="+3 vs yesterday"
          trendKind="up"
          icon="inbox"
        />
        <KPI
          label="Provisioning"
          value={provis}
          trend="ETA 3–8 min"
          trendKind="neutral"
          icon="refresh"
        />
        <KPI
          label="Issues"
          value={issues}
          trend={issues > 0 ? "Needs attention" : "All clear"}
          trendKind={issues > 0 ? "down" : "up"}
          icon="alert"
        />
        <KPI
          label="Trials expiring"
          value={trialEx}
          trend="In next 3 days"
          trendKind="neutral"
          icon="clock"
        />
        <KPI
          label="Revenue MTD"
          value={rupee(revenueMtd, { compact: true })}
          trend="From online channel"
          trendKind="up"
          icon="rupee"
        />
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-3">
          <TabBar
            items={tabItems}
            value={tab}
            onChange={setTab}
          />
          <div className="flex-1" />
          <div className="relative w-72">
            <Icon
              name="search"
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            />
            <Input
              placeholder="Search company / email / order ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={
              search
                ? "No orders match your search"
                : tab === "issues"
                  ? "No issues — all clear!"
                  : "No orders yet"
            }
            body={
              search
                ? `Try a different search term or clear filters.`
                : tab === "issues"
                  ? "Every order is provisioning smoothly."
                  : "Orders from buy-workspace-v2 will appear here in real time."
            }
            action={
              search ? (
                <Button variant="default" onClick={() => setSearch("")}>
                  <Icon name="x" size={13} />
                  Clear search
                </Button>
              ) : undefined
            }
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-muted/30">
                  {[
                    "Order", "Company", "Type", "Plan", "Seats",
                    "Amount", "Status", "Next action", "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        "px-4 py-2.5 text-xs font-medium text-ink-3",
                        (i === 4 || i === 5) ? "text-right" : "text-left",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const s = STATUS_META[o.status];
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-b border-hairline last:border-0 hover:bg-muted/20"
                      onClick={() => setOpenId(o.id)}
                    >
                      {/* Order ID */}
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-ink">
                          {o.id}
                        </p>
                        <p className="text-[11px] text-ink-3">{o.createdAt}</p>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{o.company}</p>
                        <p className="text-xs text-ink-3">{o.contact.email}</p>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        {o.type === "paid" ? (
                          <Badge kind="success" dot>Paid</Badge>
                        ) : (
                          <Badge kind="info" dot>
                            Trial · D{o.trialDay}
                          </Badge>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-ink">{o.tier}</p>
                        <p className="text-[11px] text-ink-3">
                          {o.billing === "annual"
                            ? "Annual"
                            : o.billing === "monthly"
                              ? "Monthly"
                              : "14-day trial"}
                        </p>
                      </td>

                      {/* Seats */}
                      <td className="px-4 py-3 text-right tabular-nums text-ink">
                        {o.seats}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {o.total != null ? (
                          <span className="font-medium text-ink">
                            {rupee(o.total)}
                          </span>
                        ) : (
                          <span className="italic text-ink-3">Trial</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge kind={s.kind} dot>{s.label}</Badge>
                      </td>

                      {/* Next action */}
                      <td className="max-w-[200px] px-4 py-3 text-xs text-ink-3">
                        <p className="line-clamp-2">{o.nextAction}</p>
                      </td>

                      {/* Open */}
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOpenId(o.id)}
                        >
                          <Icon name="arrow_right" size={13} />
                          Open
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Detail drawer ── */}
      {openOrder && (
        <OrderDetailDrawer
          order={openOrder}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
