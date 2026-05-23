/* eslint-disable */
// B2 — Customer Portal Dashboard (end-customer view)

function PortalScreen() {
  const { toast } = useToast();

  return (
    <div className="content" style={{ maxWidth: 980, padding: "28px 32px 80px", margin: "0 auto" }}>
      {/* Banner — this is the customer's experience, dropped into the same shell */}
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Customer view preview</b> · This is what Acme Corp's Rajesh sees when he logs in</span>
        <Badge kind="info">B2 · Portal Dashboard</Badge>
      </div>

      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Welcome back, Rajesh.</h1>
            <p className="page-sub">Acme Corp Pvt Ltd · acmecorp.com · Customer since Sep 2023</p>
          </div>
          <Btn icon="logout" kind="default">Sign out</Btn>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KPI label="Active subs"     value="2"      icon="refresh" />
        <KPI label="Total seats"     value="30"     trend="3 unused — claim now" trendKind="neutral" icon="users" />
        <KPI label="Monthly spend"   value="₹38.5K" trend="Annual save: ₹46K" trendKind="up" icon="rupee" />
        <KPI label="Open tickets"    value="1"      trend="In progress" trendKind="neutral" icon="ticket" />
      </div>

      {/* Subscription cards */}
      <div className="stack-16" style={{ marginBottom: 24 }}>
        <SubscriptionCard
          plan="Google Workspace Plus"
          status="active"
          seats={25} unused={3}
          cost={34500}
          billing="Annual"
          renewal="15 Sep 2026"
          renewalDays={118}
          toast={toast}
        />
        <SubscriptionCard
          plan="Google Voice Standard"
          status="active"
          seats={5} unused={0}
          cost={4000}
          billing="Annual"
          renewal="15 Sep 2026"
          renewalDays={118}
          toast={toast}
        />
      </div>

      <Card title="Quick Actions" style={{ marginBottom: 24 }}>
        <div className="grid grid-4">
          {[
            { icon: "download", label: "Download invoices" },
            { icon: "ticket",   label: "Raise a ticket" },
            { icon: "calendar", label: "Schedule a call" },
            { icon: "chart",    label: "Usage report" },
          ].map(qa => (
            <button key={qa.label} className="card tight" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 20, cursor: "pointer", transition: "background 120ms" }}
              onClick={() => toast(`${qa.label} → opening`)}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = ""}>
              <I name={qa.icon} size={20} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>{qa.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Recent invoices" actions={<Btn size="sm" kind="ghost" iconRight="arrow_right">View all</Btn>}>
        <table className="tbl">
          <thead><tr><th>Invoice #</th><th>Date</th><th className="right">Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td className="mono" style={{ fontSize: 12 }}>INV-2026-0089</td><td>15 May 2026</td><td className="right tnum">{rupee(490644)}</td><td><Badge kind="warning" dot>Pending</Badge></td><td><Btn size="sm" icon="download" kind="ghost">PDF</Btn></td></tr>
            <tr><td className="mono" style={{ fontSize: 12 }}>INV-2026-0067</td><td>15 Feb 2026</td><td className="right tnum">{rupee(312000)}</td><td><Badge kind="success" dot>Paid</Badge></td><td><Btn size="sm" icon="download" kind="ghost">PDF</Btn></td></tr>
            <tr><td className="mono" style={{ fontSize: 12 }}>INV-2025-0098</td><td>15 Nov 2025</td><td className="right tnum">{rupee(312000)}</td><td><Badge kind="success" dot>Paid</Badge></td><td><Btn size="sm" icon="download" kind="ghost">PDF</Btn></td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SubscriptionCard({ plan, status, seats, unused, cost, billing, renewal, renewalDays, toast }) {
  return (
    <Card>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div className="serif" style={{ fontSize: 22 }}>{plan}</div>
          <Vendor name="google" />
        </div>
        <Badge kind="success" dot>Active</Badge>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 16, padding: "12px 0", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
        <Stat2 label="Seats"          value={`${seats}`} sub={unused > 0 ? `${unused} unused` : "Fully used"} />
        <Stat2 label="Monthly cost"   value={rupee(cost)} />
        <Stat2 label="Billing"        value={billing} />
        <Stat2 label="Renewal"        value={renewal} sub={`${renewalDays} days`} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Btn kind="default" icon="users" onClick={() => toast("Manage users")}>Manage users</Btn>
        <Btn kind="default" icon="trending_up" onClick={() => toast("Upgrade flow")}>Upgrade plan</Btn>
        <Btn kind="default" icon="file" onClick={() => toast("Renewal quote requested")}>Renewal quote</Btn>
        <Btn kind="ghost" icon="message">Support</Btn>
      </div>
    </Card>
  );
}

function Stat2({ label, value, sub }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="serif tnum" style={{ fontSize: 20 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.portal = PortalScreen;
