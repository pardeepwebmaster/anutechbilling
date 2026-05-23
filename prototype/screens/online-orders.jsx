/* eslint-disable */
// Online Orders — admin view for incoming orders from the buy-workspace-v2 page (paid + trial)
// Shows real-time pipeline: new orders → provisioning → DNS pending → active.
// Trials shown alongside with their own status (day N of 14, convert tracking, etc.)

// ============================================================
// Sample data — orders flowing in from the customer-facing buy page
// ============================================================
const ONLINE_ORDERS = [
  // ───── Today's paid orders ─────
  {
    id: "ORD-2026-0089", type: "paid", createdAt: "20 May · 09:42 AM",
    company: "Acme Corp Pvt Ltd", domain: "acmecorp.com", gstin: "27AAACA1234B1Z5",
    contact: { name: "Rajesh Kumar", email: "rajesh@acmecorp.com", phone: "+91 98765 43210" },
    tier: "Business Standard", seats: 25, billing: "annual",
    monthlyRate: 864, lineTotal: 259200, gst: 46656, total: 305856,
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
    razorpayId: "pay_NMxJkl2210", invoiceNo: "INV-2026-0153",
    status: "issue", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "failed", users: "pending", dns: "pending", welcome: "pending" },
    amAssigned: "Pardeep A", nextAction: "⚠ Domain already exists in another tenant — needs manual resolution",
  },

  // ───── Trials (active) ─────
  {
    id: "TRL-2026-0042", type: "trial", createdAt: "20 May · 11:15 AM",
    company: "Beta Industries Pvt Ltd", domain: "betaind.in", gstin: null,
    contact: { name: "Priya Menon", email: "priya@betaind.in", phone: "+91 98765 11111" },
    tier: "Business Starter", seats: 15, billing: null,
    monthlyRate: 270, lineTotal: null, gst: null, total: null,
    trialDay: 1, trialEndsOn: "03 Jun 2026",
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
    status: "trial-expired", source: "buy-workspace-v2",
    progress: { signup: "done", domainVerify: "done", tenant: "done", welcome: "done", day3CheckIn: "done", day10Convert: "done" },
    amAssigned: "Anjali R", nextAction: "Did not convert · tenant suspended · send winback email",
  },

  // ───── Older successful conversions ─────
  {
    id: "ORD-2026-0085", type: "paid", createdAt: "18 May · 10:00 AM",
    company: "Indigo Travels Ltd", domain: "indigotravels.co.in", gstin: "27AABCI3344L1Z5",
    contact: { name: "Rohan S", email: "rohan@indigotravels.co.in", phone: "+91 99800 77665" },
    tier: "Business Standard", seats: 32, billing: "annual",
    monthlyRate: 864, lineTotal: 331776, gst: 59720, total: 391496,
    razorpayId: "pay_NMxOpq3344", invoiceNo: "INV-2026-0152",
    status: "active", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "done", users: "done", dns: "done", welcome: "done" },
    amAssigned: "Pardeep A", nextAction: "Live · NPS survey scheduled for Day 30",
  },
  {
    id: "ORD-2026-0084", type: "paid", createdAt: "17 May · 06:45 PM",
    company: "Jovial Education Pvt", domain: "jovialedu.in", gstin: "27AAACJ5566G1Z3",
    contact: { name: "Kavita D", email: "kavita@jovialedu.in", phone: "+91 91999 22334" },
    tier: "Business Starter", seats: 12, billing: "annual",
    monthlyRate: 270, lineTotal: 38880, gst: 6998, total: 45878,
    razorpayId: "pay_NMxRst5566", invoiceNo: "INV-2026-0151",
    status: "active", source: "buy-workspace-v2",
    progress: { payment: "done", invoice: "done", tenant: "done", users: "done", dns: "done", welcome: "done" },
    amAssigned: "Anjali R", nextAction: "Live · onboarding training delivered yesterday",
  },
];

// ============================================================
// Status pill config — visual treatment for each state
// ============================================================
const STATUS_META = {
  // Paid
  "provisioning":      { label: "Provisioning",      color: "warning", icon: "refresh" },
  "dns-pending":       { label: "DNS pending",       color: "info",    icon: "clock" },
  "active":            { label: "Active",            color: "success", icon: "check_circle" },
  "issue":             { label: "Issue",             color: "danger",  icon: "alert" },
  // Trial
  "trial-active":      { label: "Trial · active",    color: "info",    icon: "rocket" },
  "trial-converting":  { label: "Trial · converting", color: "warning", icon: "refresh" },
  "trial-expired":     { label: "Trial · expired",   color: "muted",   icon: "x_circle" },
};

// Progress step labels per type
const PAID_STEPS = [
  { key: "payment",   label: "Payment",        icon: "rupee" },
  { key: "invoice",   label: "GST Invoice",    icon: "receipt" },
  { key: "tenant",    label: "Tenant",         icon: "globe" },
  { key: "users",     label: "Users created",  icon: "users" },
  { key: "dns",       label: "DNS verified",   icon: "shield" },
  { key: "welcome",   label: "Welcome email",  icon: "mail" },
];
const TRIAL_STEPS = [
  { key: "signup",        label: "Signup",         icon: "check" },
  { key: "domainVerify",  label: "Domain verify",  icon: "globe" },
  { key: "tenant",        label: "Trial tenant",   icon: "rocket" },
  { key: "welcome",       label: "Welcome email",  icon: "mail" },
  { key: "day3CheckIn",   label: "Day 3 check-in", icon: "clock" },
  { key: "day10Convert",  label: "Day 10 convert", icon: "rupee" },
];

// ============================================================
// Main screen
// ============================================================
function OnlineOrdersScreen() {
  const [tab, setTab]       = useState("all");      // all | paid | trial | issues
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);       // ID of order in detail drawer
  const { toast } = useToast();

  // Filter
  const filtered = ONLINE_ORDERS.filter(o => {
    if (tab === "paid"   && o.type !== "paid")    return false;
    if (tab === "trial"  && o.type !== "trial")   return false;
    if (tab === "issues" && o.status !== "issue") return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.company.toLowerCase().includes(q) &&
          !o.id.toLowerCase().includes(q) &&
          !o.contact.email.toLowerCase().includes(q) &&
          !o.domain.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const today    = ONLINE_ORDERS.filter(o => o.createdAt.includes("20 May")).length;
  const provis   = ONLINE_ORDERS.filter(o => o.status === "provisioning").length;
  const issues   = ONLINE_ORDERS.filter(o => o.status === "issue").length;
  const trialEx  = ONLINE_ORDERS.filter(o => o.type === "trial" && o.trialDay >= 11 && o.status === "trial-active").length;
  const revenueMTD = ONLINE_ORDERS
    .filter(o => o.type === "paid")
    .reduce((s, o) => s + (o.total || 0), 0);

  const openOrder = ONLINE_ORDERS.find(o => o.id === openId);

  return (
    <div className="content">
      {/* === Header === */}
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 28 }}>Online Orders</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            Live pipeline from <b>buy-workspace-v2</b> · Paid + Trial · {ONLINE_ORDERS.length} total
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Btn icon="refresh" onClick={() => toast("Refreshed")}>Refresh</Btn>
          <Btn icon="download" onClick={() => toast("Exporting CSV…")}>Export</Btn>
          <Btn kind="primary" icon="settings" onClick={() => toast("Opening automation rules")}>Automation rules</Btn>
        </div>
      </div>

      {/* Gemini AI orders intelligence */}
      <GeminiCard
        title="Orders AI · Today's focus"
        actions={
          <>
            <Btn size="sm" kind="primary" icon="alert" onClick={() => toast("Escalating Hotel Asia issue to Google support")}>Fix Hotel Asia issue</Btn>
            <Btn size="sm" icon="phone" onClick={() => toast("Calling Beta Industries — new trial")}>Welcome call to Beta</Btn>
          </>
        }
        compact
      >
        <b style={{ color: "var(--ink)" }}>{issues} blocker · {trialEx} conversion opportunity.</b> Hotel Asia provisioning is stuck (domain conflict) — fix to unblock ₹4.9L revenue. Cosmo Tech is on Day 11 of trial with high engagement — perfect time to send convert quote. Beta Industries just signed up — first call within 2 hours is your conversion edge.
      </GeminiCard>

      {/* === Stats row === */}
      <div className="grid grid-5" style={{ marginBottom: 16 }}>
        <KPI label="New today"          icon="inbox"        value={today}                    trend="+3 vs yesterday" trendKind="up" trendIcon="arrow_up_right" />
        <KPI label="Provisioning"       icon="refresh"      value={provis}                   trend="ETA 3-8 min"    trendKind="neutral" />
        <KPI label="Issues"             icon="alert"        value={issues}                   trend={issues ? "Needs attention" : "All clear"} trendKind={issues ? "down" : "up"} trendIcon={issues ? "alert" : "check"} />
        <KPI label="Trials expiring"    icon="clock"        value={trialEx}                  trend="In next 3 days" trendKind="neutral" />
        <KPI label="Revenue MTD"        icon="rupee"        value={rupee(revenueMTD, { compact: true })} trend="From online channel" trendKind="up" />
      </div>

      {/* === Tabs + search === */}
      <Card flush>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--hairline)" }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "all",    label: `All · ${ONLINE_ORDERS.length}` },
              { id: "paid",   label: `Paid · ${ONLINE_ORDERS.filter(o => o.type === "paid").length}` },
              { id: "trial",  label: `Trials · ${ONLINE_ORDERS.filter(o => o.type === "trial").length}` },
              { id: "issues", label: `Issues · ${ONLINE_ORDERS.filter(o => o.status === "issue").length}` },
            ]}
          />
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative", width: 280 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", display: "grid", placeItems: "center", pointerEvents: "none" }}>
              <I name="search" size={13} />
            </span>
            <input
              placeholder="Search company / email / order ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "7px 10px 7px 30px", fontSize: 12,
                border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--paper-2)",
                outline: "none", color: "var(--ink)",
              }}
            />
          </div>
        </div>

        {/* === Table === */}
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Order</th>
              <th>Company</th>
              <th style={{ width: 80 }}>Type</th>
              <th>Plan</th>
              <th className="right" style={{ width: 60 }}>Seats</th>
              <th className="right" style={{ width: 110 }}>Amount</th>
              <th style={{ width: 150 }}>Status</th>
              <th>Next action</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const s = STATUS_META[o.status];
              return (
                <tr key={o.id} onClick={() => setOpenId(o.id)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{o.id}</div>
                    <div className="sub" style={{ fontSize: 11 }}>{o.createdAt}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{o.company}</div>
                    <div className="sub" style={{ fontSize: 11, color: "var(--ink-3)" }}>{o.contact.email}</div>
                  </td>
                  <td>
                    {o.type === "paid"
                      ? <Badge kind="success" dot>Paid</Badge>
                      : <Badge kind="info" dot>Trial · D{o.trialDay}</Badge>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {o.tier}
                    <div className="sub" style={{ fontSize: 11 }}>{o.billing === "annual" ? "Annual" : o.billing === "monthly" ? "Monthly" : "14-day trial"}</div>
                  </td>
                  <td className="right tnum">{o.seats}</td>
                  <td className="right tnum" style={{ fontSize: 12 }}>
                    {o.total != null
                      ? <span style={{ fontWeight: 500 }}>{rupee(o.total)}</span>
                      : <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>Trial</span>}
                  </td>
                  <td>
                    <Badge kind={s.color} dot>{s.label}</Badge>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--ink-2)" }}>
                    {o.nextAction}
                  </td>
                  <td className="right" onClick={(e) => e.stopPropagation()}>
                    <Btn size="sm" kind="ghost" icon="arrow_right" onClick={() => setOpenId(o.id)}>Open</Btn>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="9" style={{ padding: 0 }}>
                <EmptyState
                  icon="inbox"
                  title={search ? "No orders match your search" : tab === "issues" ? "No issues — all clear!" : "No orders yet"}
                  body={search
                    ? `Try a different search term or clear filters to see all ${ONLINE_ORDERS.length} orders.`
                    : tab === "issues"
                    ? "Every order is provisioning smoothly. New issues will appear here."
                    : "Orders from buy-workspace-v2 will show up here in real time."}
                  action={search
                    ? <Btn icon="x" onClick={() => setSearch("")}>Clear search</Btn>
                    : <Btn kind="primary" icon="external" onClick={() => location.hash = "#/buy-workspace-v2"}>Open buy page</Btn>}
                />
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* === Detail drawer === */}
      {openOrder && <OrderDetailDrawer order={openOrder} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ============================================================
// Order detail drawer — full progress + actions for one order
// ============================================================
function OrderDetailDrawer({ order, onClose }) {
  const { toast } = useToast();
  const isPaid = order.type === "paid";
  const steps  = isPaid ? PAID_STEPS : TRIAL_STEPS;
  const s      = STATUS_META[order.status];

  const action = (msg) => { toast(msg); };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,15,15,0.32)",
      zIndex: 100, display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 540, height: "100vh", background: "var(--paper)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Drawer header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{order.id}</span>
              <Badge kind={s.color} dot>{s.label}</Badge>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              {order.company} · {order.createdAt}
            </div>
          </div>
          <IconBtn icon="x" onClick={onClose} title="Close" />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Customer info */}
          <Section title="Customer">
            <Row label="Company">{order.company}</Row>
            <Row label="Domain">{order.domain}</Row>
            {order.gstin && <Row label="GSTIN" mono>{order.gstin}</Row>}
            <Row label="Contact">{order.contact.name}</Row>
            <Row label="Email">{order.contact.email}</Row>
            <Row label="Phone">{order.contact.phone}</Row>
          </Section>

          {/* Order details */}
          <Section title={isPaid ? "Order" : "Trial"}>
            <Row label="Plan">{order.tier}</Row>
            <Row label="Seats">{order.seats}</Row>
            {isPaid ? (
              <>
                <Row label="Billing">{order.billing === "annual" ? "Annual" : "Monthly"}</Row>
                <Row label="Rate/seat">{rupee(order.monthlyRate)}/month</Row>
                <Row label="Line total">{rupee(order.lineTotal)}</Row>
                <Row label="GST (18%)">{rupee(order.gst)}</Row>
                <Row label="Total"><b style={{ color: "var(--amber)" }}>{rupee(order.total)}</b></Row>
                <Row label="Razorpay ID" mono>{order.razorpayId}</Row>
                <Row label="Invoice" mono>{order.invoiceNo}</Row>
              </>
            ) : (
              <>
                <Row label="Day"><b>Day {order.trialDay} of 14</b></Row>
                <Row label="Expires">{order.trialEndsOn}</Row>
              </>
            )}
            <Row label="Source" mono>{order.source}</Row>
            <Row label="Assigned to">{order.amAssigned}</Row>
          </Section>

          {/* Progress checklist */}
          <Section title="Automation progress">
            <div className="stack-12">
              {steps.map(step => {
                const state = order.progress[step.key] || "pending";
                const cfg = {
                  done:        { color: "var(--emerald)",     bg: "var(--emerald-soft)", icon: "check"   },
                  active:      { color: "var(--amber)",       bg: "var(--amber-soft)",   icon: "refresh" },
                  "in-progress": { color: "var(--amber)",     bg: "var(--amber-soft)",   icon: "refresh" },
                  pending:     { color: "var(--ink-3)",       bg: "var(--paper-2)",      icon: "clock"   },
                  failed:      { color: "var(--rose)",        bg: "var(--rose-soft)",    icon: "alert"   },
                }[state] || { color: "var(--ink-3)", bg: "var(--paper-2)", icon: "clock" };

                return (
                  <div key={step.key} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", background: cfg.bg, borderRadius: 8,
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--paper)", color: cfg.color, display: "grid", placeItems: "center" }}>
                      <I name={cfg.icon} size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{step.label}</div>
                      <div style={{ fontSize: 11, color: cfg.color, textTransform: "capitalize", fontWeight: 500 }}>
                        {state === "done" ? "Completed" : state === "active" || state === "in-progress" ? "Running…" : state === "failed" ? "Failed — needs attention" : "Pending"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Next action box */}
          <Section title="Next action">
            <div style={{
              padding: "12px 14px",
              background: order.status === "issue" ? "var(--rose-soft)" : "var(--amber-soft)",
              border: "1px solid " + (order.status === "issue" ? "var(--rose)" : "var(--amber)"),
              borderRadius: 8,
              fontSize: 13,
              color: "var(--ink)",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}>
              <I name={order.status === "issue" ? "alert" : "info"} size={14} style={{ color: order.status === "issue" ? "var(--rose)" : "var(--amber)", flexShrink: 0, marginTop: 2 }} />
              <div>{order.nextAction}</div>
            </div>
          </Section>
        </div>

        {/* Action bar at bottom */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--hairline)",
          background: "var(--paper-2)",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}>
          {isPaid && order.status === "provisioning" && (
            <Btn size="sm" kind="primary" icon="refresh" onClick={() => action("Re-running provisioning…")}>Retry provisioning</Btn>
          )}
          {isPaid && order.status === "dns-pending" && (
            <Btn size="sm" kind="primary" icon="mail" onClick={() => action("DNS guide re-sent")}>Re-send DNS guide</Btn>
          )}
          {isPaid && order.status === "issue" && (
            <Btn size="sm" kind="primary" icon="alert" onClick={() => action("Escalating to Google support…")}>Escalate to Google</Btn>
          )}
          {!isPaid && order.status === "trial-active" && order.trialDay >= 7 && (
            <Btn size="sm" kind="primary" icon="rupee" onClick={() => action("Conversion quote sent")}>Send convert quote</Btn>
          )}
          {!isPaid && order.status === "trial-active" && order.trialDay < 7 && (
            <Btn size="sm" kind="primary" icon="phone" onClick={() => action("Marking call as done…")}>Log AM call</Btn>
          )}
          {!isPaid && order.status === "trial-expired" && (
            <Btn size="sm" kind="primary" icon="mail" onClick={() => action("Winback email queued")}>Send winback</Btn>
          )}

          <Btn size="sm" icon="whatsapp" onClick={() => action(`Opening WhatsApp chat with ${order.contact.name}`)}>WhatsApp</Btn>
          <Btn size="sm" icon="phone" onClick={() => action(`Calling ${order.contact.phone}`)}>Call</Btn>
          <Btn size="sm" icon="mail" onClick={() => action(`Composing email to ${order.contact.email}`)}>Email</Btn>
          {isPaid && <Btn size="sm" icon="download" onClick={() => action("Downloading invoice PDF…")}>Invoice</Btn>}
          <div style={{ flex: 1 }} />
          <Btn size="sm" kind="ghost" icon="external" onClick={() => action("Opening Google Admin Console")}>Admin console</Btn>
        </div>
      </div>
    </div>
  );
}

// Small helper components for the drawer
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ label, children, mono }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "6px 0", fontSize: 13, alignItems: "center" }}>
      <div style={{ color: "var(--ink-3)" }}>{label}</div>
      <div className={mono ? "mono" : ""} style={{ color: "var(--ink)" }}>{children}</div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS["online-orders"] = OnlineOrdersScreen;
