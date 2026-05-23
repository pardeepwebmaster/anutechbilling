/* eslint-disable */
// E3 — Investment & Pricing

function PricingScreen() {
  return (
    <div className="content" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 28, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Client demo view</b> · Transparent cost + ROI breakdown</span>
        <Badge kind="info">E3 · Investment</Badge>
      </div>

      <div className="page-head" style={{ textAlign: "center" }}>
        <div className="page-eyebrow">Investment</div>
        <h1 className="page-title">Simple, transparent pricing.</h1>
        <p className="page-sub" style={{ margin: "8px auto 0", textAlign: "center" }}>One-time build + support included. ROI in 3–4 months.</p>
      </div>

      <div className="grid grid-3" style={{ margin: "40px 0 32px", alignItems: "stretch" }}>
        <PlanCard name="Starter" price="₹1.2L" sub="One-time + 3 months support" feats={[
          { txt: "Foundation (Phase 1)",           ok: true },
          { txt: "Sales pipeline (Phase 2)",       ok: true },
          { txt: "Activity timeline",              ok: true },
          { txt: "Basic automation (3 rules)",     ok: true },
          { txt: "WhatsApp integration",           ok: false },
          { txt: "Customer portal",                ok: false },
          { txt: "AI features",                    ok: false },
        ]} cta="Choose Starter" />

        <PlanCard featured name="Complete" price="₹2.5L" sub="One-time + 6 months support" feats={[
          { txt: "Everything in Starter",          ok: true, bold: true },
          { txt: "Automation engine (Phase 3)",    ok: true },
          { txt: "12+ pre-built rules",            ok: true },
          { txt: "WhatsApp integration",           ok: true },
          { txt: "Customer self-service portal",   ok: true },
          { txt: "Bulk campaigns",                 ok: true },
          { txt: "Custom reports",                 ok: true },
          { txt: "AI lead scoring",                ok: true },
        ]} cta="Choose Complete" />

        <PlanCard name="Enterprise" price="₹4.5L" sub="One-time + 12 months support" feats={[
          { txt: "Everything in Complete",         ok: true, bold: true },
          { txt: "Multi-vendor (Google + MS + Zoho)", ok: true },
          { txt: "Custom branding / white-label",  ok: true },
          { txt: "Advanced AI analyst",            ok: true },
          { txt: "Priority support (4hr SLA)",     ok: true },
          { txt: "Custom integrations",            ok: true },
          { txt: "Dedicated account manager",      ok: true },
        ]} cta="Choose Enterprise" />
      </div>

      <Card title="Included in every plan" style={{ marginBottom: 24 }}>
        <div className="grid grid-2" style={{ gap: 8 }}>
          {[
            "Source code ownership (full rights)",
            "Firebase deployment included",
            "Documentation + SOPs",
            "Team training (2 sessions)",
            "Data migration from existing tools",
            "Razorpay + GST + Zoho integration",
            "Mobile-responsive design",
            "Bug fixes during support period",
          ].map(t => (
            <div key={t} className="row" style={{ gap: 8, fontSize: 13 }}>
              <I name="check" size={14} style={{ color: "var(--emerald)" }} />
              {t}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Recurring costs" sub="Pay-as-you-go services — not part of project fee" style={{ marginBottom: 24 }}>
        <table className="tbl">
          <thead><tr><th>Service</th><th>Provider</th><th className="right">Estimated monthly</th></tr></thead>
          <tbody>
            <tr><td>Firebase hosting + Firestore</td><td>Google</td><td className="right tnum">₹500 – 1,500</td></tr>
            <tr><td>Cloud Functions</td><td>Google</td><td className="right tnum">₹0 – 500</td></tr>
            <tr><td>WhatsApp Business API</td><td>Meta / Twilio</td><td className="right tnum">₹1 – 2 per message</td></tr>
            <tr><td>Razorpay transaction fee</td><td>Razorpay</td><td className="right tnum">2% of transaction</td></tr>
            <tr><td>Domain + SSL</td><td>Any registrar</td><td className="right tnum">₹100 / mo</td></tr>
            <tr><td><b>Total recurring</b></td><td></td><td className="right tnum"><b>~₹1,500 – 3,000 / month</b></td></tr>
          </tbody>
        </table>
      </Card>

      <Card style={{ background: "var(--emerald-soft)", borderColor: "transparent" }}>
        <div className="rail-label" style={{ padding: 0, color: "var(--emerald)" }}>Return on investment</div>
        <h2 className="serif" style={{ fontSize: 28, margin: "8px 0 24px", color: "var(--emerald)" }}>Payback in 3 – 4 months.</h2>
        <div className="grid grid-4">
          <RoiStat top="Current revenue" big="₹50L /yr" sub="Baseline" />
          <RoiStat top="Renewals saved" big="+₹7.5L /yr" sub="15% renewal improvement" tone="emerald" />
          <RoiStat top="Sales velocity" big="+₹10L /yr" sub="20% faster close" tone="emerald" />
          <RoiStat top="Payback period" big="3 – 4 months" sub="" />
        </div>
      </Card>
    </div>
  );
}

function PlanCard({ name, price, sub, feats, cta, featured }) {
  return (
    <div className="card" style={{
      border: featured ? "2px solid var(--amber)" : "1px solid var(--hairline)",
      padding: 24,
      position: "relative",
      display: "flex", flexDirection: "column",
    }}>
      {featured && <Badge kind="warning" style={{ position: "absolute", top: -10, left: 24 }}>Recommended</Badge>}
      <div className="rail-label" style={{ padding: 0 }}>{name}</div>
      <div className="serif tnum" style={{ fontSize: 52, lineHeight: 1, margin: "10px 0 4px" }}>{price}</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 18 }}>{sub}</div>
      <div className="stack-8" style={{ flex: 1, marginBottom: 18 }}>
        {feats.map((f, i) => (
          <div key={i} className="row" style={{ gap: 8, fontSize: 13, color: f.ok ? "var(--ink)" : "var(--ink-4)", fontWeight: f.bold ? 600 : 400 }}>
            {f.ok ? <I name="check" size={14} style={{ color: "var(--emerald)" }} />
                  : <I name="x" size={14} style={{ color: "var(--ink-4)" }} />}
            {f.txt}
          </div>
        ))}
      </div>
      <Btn kind={featured ? "primary" : "default"} style={{ width: "100%", justifyContent: "center" }}>{cta}</Btn>
    </div>
  );
}

function RoiStat({ top, big, sub, tone }) {
  return (
    <div>
      <div className="field-label" style={{ color: tone ? `var(--${tone})` : undefined }}>{top}</div>
      <div className="serif tnum" style={{ fontSize: 22, marginTop: 4, color: tone ? `var(--${tone})` : undefined }}>{big}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.pricing = PricingScreen;
