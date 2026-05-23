/* eslint-disable */
// B4 — Onboarding Wizard (DNS setup step 3 of 4)

function OnboardingScreen() {
  const [step, setStep] = useState(3);
  const { toast } = useToast();
  const steps = [
    { id: 1, label: "Plan & seats" },
    { id: 2, label: "Payment" },
    { id: 3, label: "DNS setup" },
    { id: 4, label: "Provisioning" },
  ];

  return (
    <div className="content narrow" style={{ padding: "40px 24px 80px" }}>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 28, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Customer view</b> · Onboarding flow after purchase</span>
        <Badge kind="info">B4 · Onboarding</Badge>
      </div>

      {/* Stepper */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 6, marginBottom: 28 }}>
        {steps.map(s => (
          <div key={s.id} style={{
            height: 4,
            borderRadius: 2,
            background: s.id < step ? "var(--emerald)" : s.id === step ? "var(--amber)" : "var(--paper-3)",
          }} />
        ))}
      </div>

      <div className="page-head">
        <div className="page-eyebrow">Step {step} of {steps.length}</div>
        <h1 className="page-title">DNS Setup & Verification</h1>
        <p className="page-sub">
          We'll configure MX, SPF, DKIM and DMARC records for <b>acmecorp.com</b>. Add these records to your domain control panel and we'll verify automatically.
        </p>
      </div>

      <Card title="MX Records — Mail routing" style={{ marginBottom: 16 }}>
        <table className="tbl">
          <thead><tr><th>Priority</th><th>Hostname</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td className="tnum">1</td><td className="mono">@</td><td className="mono">aspmx.l.google.com</td><td><Badge kind="success" dot>Verified</Badge></td></tr>
            <tr><td className="tnum">5</td><td className="mono">@</td><td className="mono">alt1.aspmx.l.google.com</td><td><Badge kind="success" dot>Verified</Badge></td></tr>
            <tr><td className="tnum">5</td><td className="mono">@</td><td className="mono">alt2.aspmx.l.google.com</td><td><Badge kind="warning" dot>Pending</Badge></td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="SPF Record" style={{ marginBottom: 16 }}>
        <div className="code">
          v=spf1 include:_spf.google.com ~all
          <button className="code-copy" onClick={() => toast("Copied to clipboard")}><I name="copy" size={11} /> Copy</button>
        </div>
        <div style={{ marginTop: 10 }}><Badge kind="success" dot>Verified · 2 hours ago</Badge></div>
      </Card>

      <Card title="Domain ownership verification" style={{ marginBottom: 16 }}>
        <div className="code">
          google-site-verification=abc123xyz_REPLACE_ME_REPLACE_ME
          <button className="code-copy" onClick={() => toast("Copied to clipboard")}><I name="copy" size={11} /> Copy</button>
        </div>
        <div style={{ marginTop: 10 }}><Badge kind="warning" dot>Will verify in 24 hrs</Badge></div>
      </Card>

      {/* Help callout */}
      <Card style={{ background: "var(--amber-soft)", borderColor: "transparent", marginBottom: 16 }}>
        <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: "var(--amber)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <I name="phone" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "var(--amber-ink)" }}>Stuck somewhere?</div>
            <div style={{ fontSize: 13, color: "var(--amber-ink)", opacity: 0.8 }}>Our team will jump on a 15-min screen share and fix DNS for you. Free.</div>
          </div>
          <Btn kind="accent">Schedule call</Btn>
        </div>
      </Card>

      <div className="row" style={{ justifyContent: "space-between", marginTop: 24 }}>
        <Btn kind="ghost" icon="arrow_left" onClick={() => setStep(Math.max(1, step - 1))}>Back</Btn>
        <div className="row" style={{ gap: 8 }}>
          <Btn kind="default" icon="message">Need help?</Btn>
          <Btn kind="primary" iconRight="arrow_right" onClick={() => setStep(Math.min(steps.length, step + 1))}>Continue to provisioning</Btn>
        </div>
      </div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.onboarding = OnboardingScreen;
