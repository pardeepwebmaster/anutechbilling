/* eslint-disable */
// B5 — Customer Support Center

function SupportCustomerScreen() {
  return (
    <div className="content" style={{ maxWidth: 980, padding: "28px 32px 80px", margin: "0 auto" }}>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Customer view</b> · Support center inside Acme's portal</span>
        <Badge kind="info">B5 · Customer Support</Badge>
      </div>

      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Support Center</h1>
            <p className="page-sub">Acme Corp · Logged in as Rajesh</p>
          </div>
          <Btn kind="primary" icon="plus">Raise new ticket</Btn>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KPI label="Open tickets"     value="1" icon="ticket" />
        <KPI label="Avg response"     value="2.5" unit="h" trend="−45m" trendKind="up" trendIcon="trending_down" />
        <KPI label="Resolved · 30d"   value="8" trend="100% on-time" trendKind="up" />
        <KPI label="CSAT score"       value="4.8" unit="/5" icon="smile" />
      </div>

      <Card title="Open tickets" style={{ marginBottom: 20 }}>
        <div style={{ border: "1px solid var(--amber)", background: "var(--amber-soft)", borderRadius: 10, padding: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, color: "var(--amber-ink)" }}>#TKT-2026-0142 · Unable to add user to Workspace</div>
              <div style={{ fontSize: 12, color: "var(--amber-ink)", opacity: 0.7, marginTop: 4 }}>
                Opened 2 hours ago · Priority Medium · Assigned Priya R
              </div>
            </div>
            <Badge kind="warning" dot>In progress</Badge>
          </div>
          <div style={{ fontSize: 13, color: "var(--amber-ink)", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(193,65,12,0.2)" }}>
            We're trying to add a new user but getting 'license limit exceeded' error. We currently have 3 unused seats according to admin console…
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn kind="default" size="sm" iconRight="arrow_right">View conversation</Btn>
          </div>
        </div>
      </Card>

      <Card title="Knowledge base — most searched" style={{ marginBottom: 20 }}>
        <div className="grid grid-2">
          {[
            { title: "How to add a new user to Workspace?", meta: "3 min read · Updated last week" },
            { title: "DNS records setup guide",              meta: "5 min read · Updated yesterday" },
            { title: "Migrating emails from Outlook",         meta: "8 min read" },
            { title: "Two-factor authentication setup",       meta: "4 min read" },
          ].map(kb => (
            <button key={kb.title} className="card tight" style={{ textAlign: "left", cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = ""}>
              <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                <I name="book" size={16} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{kb.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{kb.meta}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Need urgent help?">
        <div className="grid grid-3">
          {[
            { icon: "phone",    label: "Phone support",  big: "+91 99999 99999", note: "9 AM – 9 PM IST, all days" },
            { icon: "whatsapp", label: "WhatsApp",       big: "+91 88888 88888", note: "24×7 chat support" },
            { icon: "mail",     label: "Email",          big: "support@excelt.in", note: "4 hr response SLA" },
          ].map(c => (
            <div key={c.label} className="card tight">
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                <I name={c.icon} />
                {c.label}
              </div>
              <div className="serif" style={{ fontSize: 18, marginTop: 8 }}>{c.big}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{c.note}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS["support-customer"] = SupportCustomerScreen;
