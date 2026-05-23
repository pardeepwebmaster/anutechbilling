/* eslint-disable */
// E4 — Before vs After

function ComparisonScreen() {
  const rows = [
    ["Lead management",       "Excel sheets, WhatsApp screenshots, kuch leads bhool jaate hain",  "Kanban pipeline, drag-drop, auto-assigned"],
    ["Quote sending",         "Word/Excel me banake email, GST manual calculate",                  "2 click me quote ban jata, GST auto, PDF + WhatsApp send"],
    ["Invoicing",             "Manual entry, Zoho me alag login, errors common",                   "Auto-generate from quote, Zoho sync automatic"],
    ["Renewals",              "Spreadsheet me track, 30% renewals slip",                            "T-90/60/30 day alerts, 90%+ renewal rate"],
    ["Payment reconcile",     "Bank statement check, weekly 5 hours waste",                        "Razorpay webhook auto-marks paid, 0 manual hours"],
    ["Customer support",      "Email back-and-forth, history Gmail me khoyi",                       "Ticket system + activity timeline, full history"],
    ["Reports",                "3 spreadsheets se collate",                                          "Live dashboard 24×7, MRR/ARR/churn auto-calculate"],
    ["Team collaboration",    "\"Mujhe nahi pata, X ko poocho\"",                                    "Role-based dashboards, sab ek system me"],
    ["Customer experience",   "Email pe wait karein, no self-service",                              "Self-service portal, subscriptions manage khud"],
    ["Mobile access",          "Nahi hai, laptop chahiye",                                            "PWA app, anywhere from phone, offline mode"],
  ];

  const impact = [
    ["Time spent on data entry", "30 hrs/week (team)",     "5 hrs/week",         "83%"],
    ["Quote creation time",      "30 – 45 min",             "2 – 3 min",          "90%"],
    ["Invoice generation",       "15 min each",             "Auto (0 min)",       "100%"],
    ["Renewals missed",          "30% (industry avg)",      "5 – 10%",            "70%"],
    ["Sales close time",         "35 days",                  "21 days",            "40%"],
    ["Customer support response","24 – 48 hours",            "2 – 4 hours",        "85%"],
    ["Onboarding time",          "5 – 7 days",                "24 – 48 hours",     "70%"],
    ["Error rate",                "5 – 8 per month",          "0 – 1 per month",    "90%"],
  ];

  return (
    <div className="content" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 28, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Client demo view</b> · Manual pain vs ResellerOS solution</span>
        <Badge kind="info">E4 · Before vs After</Badge>
      </div>

      <div className="page-head" style={{ textAlign: "center" }}>
        <div className="page-eyebrow">Comparison</div>
        <h1 className="page-title">Aaj kya hai vs <em className="serif" style={{ fontStyle: "italic", color: "var(--amber)" }}>kal kya hoga.</em></h1>
      </div>

      <div className="grid grid-2" style={{ marginTop: 32, marginBottom: 32, alignItems: "stretch" }}>
        <div className="card" style={{ background: "var(--rose-soft)", borderColor: "transparent" }}>
          <div className="row" style={{ gap: 8, marginBottom: 14 }}>
            <I name="x_circle" style={{ color: "var(--rose)" }} />
            <div style={{ fontWeight: 700, color: "var(--rose)", fontSize: 16 }}>Aaj — manual system</div>
          </div>
          <div className="stack-12">
            {rows.map(([cat, before], i) => (
              <div key={i} style={{ paddingBottom: 10, borderBottom: i < rows.length-1 ? "1px dashed rgba(185,28,28,0.2)" : "none" }}>
                <div className="field-label" style={{ color: "var(--rose)" }}>{cat}</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{before}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ background: "var(--emerald-soft)", borderColor: "transparent" }}>
          <div className="row" style={{ gap: 8, marginBottom: 14 }}>
            <I name="check_circle" style={{ color: "var(--emerald)" }} />
            <div style={{ fontWeight: 700, color: "var(--emerald)", fontSize: 16 }}>ResellerOS ke baad</div>
          </div>
          <div className="stack-12">
            {rows.map(([cat, , after], i) => (
              <div key={i} style={{ paddingBottom: 10, borderBottom: i < rows.length-1 ? "1px dashed rgba(22,101,52,0.2)" : "none" }}>
                <div className="field-label" style={{ color: "var(--emerald)" }}>{cat}</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{after}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Card title="Quantified impact" sub="Numbers from comparable Indian reseller deployments">
        <table className="tbl">
          <thead><tr><th>Metric</th><th>Today (manual)</th><th>With ResellerOS</th><th className="right">Improvement</th></tr></thead>
          <tbody>
            {impact.map(([m, b, a, imp]) => (
              <tr key={m}>
                <td><b>{m}</b></td>
                <td style={{ color: "var(--rose)" }}>{b}</td>
                <td style={{ color: "var(--emerald)" }}>{a}</td>
                <td className="right"><Badge kind="success" dot>↓ {imp}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.comparison = ComparisonScreen;
