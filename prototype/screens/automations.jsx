/* eslint-disable */
// D1 — Automation Rules

const RULES = [
  { name: "Renewal Reminder T-30",        when: "Subscription renewal in 30 days",            then: ["Email customer", "Create task for owner"],          last: "9:00 AM today · 3 emails sent",   active: true },
  { name: "Invoice Paid → Auto-Receipt",  when: "Invoice status changes to 'Paid'",            then: ["Send receipt PDF via Email", "Send via WhatsApp"], last: "11:32 AM today · 5 receipts sent", active: true },
  { name: "Stuck Lead Alert",             when: "Lead in same stage > 7 days, no activity",    then: ["Flag red", "Notify assigned sales rep"],            last: "9:00 AM today · 4 leads flagged", active: true },
  { name: "Overdue Invoice — Day 7",      when: "Invoice unpaid 7+ days past due",             then: ["Send WhatsApp reminder", "Create finance task"],   last: "Yesterday · 2 reminders sent",    active: true },
  { name: "Trial Activation Drip",        when: "Customer starts trial",                       then: ["3-email drip over 7 days", "Schedule check-in"],   last: "Yesterday · 8 emails queued",     active: false },
];

function AutomationsScreen() {
  const { toast } = useToast();
  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Engage</div>
            <h1 className="page-title">Automations</h1>
            <p className="page-sub">{RULES.filter(r => r.active).length} active rules · Saved 15+ hours/week of manual work</p>
          </div>
          <Btn kind="primary" icon="plus">New rule</Btn>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KPI label="Active rules"    value={RULES.filter(r => r.active).length} icon="zap" />
        <KPI label="Triggered today" value="27" trend="+8 vs yesterday" trendKind="up" trendIcon="trending_up" />
        <KPI label="Time saved/wk"   value="15" unit=" h" trend="≈ 3 days of one rep" trendKind="up" icon="clock" />
        <KPI label="Success rate"    value="99.6" unit="%" trend="−0.1% issues" trendKind="neutral" icon="check_circle" />
      </div>

      <div className="rail-label" style={{ padding: 0, marginBottom: 12 }}>Active rules</div>

      <div className="stack-12" style={{ marginBottom: 32 }}>
        {RULES.map((r, i) => (
          <Card key={i}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: r.active ? "var(--emerald-soft)" : "var(--paper-2)", color: r.active ? "var(--emerald)" : "var(--ink-3)", display: "grid", placeItems: "center" }}>
                  <I name={r.active ? "check" : "lock"} size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.last}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Toggle on={r.active} />
                <Btn kind="ghost" size="sm" icon="edit">Edit</Btn>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 13, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
              <div className="field-label">When</div>
              <div>{r.when}</div>
              <div className="field-label">Then</div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {r.then.map((t, j) => (
                  <span key={j} className="badge muted" style={{ background: "var(--indigo-soft)", color: "var(--indigo-ink)" }}>
                    <span className="tnum" style={{ marginRight: 2, opacity: 0.6 }}>{j+1}</span>{t}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Create new rule" sub="Visual if-this-then-that builder">
        <div className="stack-16">
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>When (trigger)</div>
            <input className="input" defaultValue="Subscription renewal in [30] days" />
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>Then (actions in order)</div>
            <div className="stack-8">
              {["Send Email — Template: Renewal-T30", "Create Task — Assign to: Owner of customer", "Send WhatsApp — Template: Renewal-T30-WA"].map((t, i) => (
                <div key={i} className="row" style={{ background: "var(--paper-2)", padding: 10, borderRadius: 8, gap: 10 }}>
                  <div className="serif tnum" style={{ width: 22, height: 22, borderRadius: 999, background: "var(--indigo-soft)", color: "var(--indigo-ink)", display: "grid", placeItems: "center", fontSize: 12 }}>{i+1}</div>
                  <span style={{ flex: 1, fontSize: 13 }}>{t}</span>
                  <IconBtn icon="grip" />
                </div>
              ))}
              <Btn kind="ghost" size="sm" icon="plus">Add action</Btn>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <Btn kind="default" icon="play" onClick={() => toast("Test run queued")}>Test rule</Btn>
            <Btn kind="primary" icon="check" onClick={() => toast("Rule saved and activated")}>Save & activate</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Toggle({ on }) {
  const [v, setV] = useState(on);
  return (
    <button onClick={() => setV(!v)} style={{
      width: 36, height: 20, borderRadius: 999,
      background: v ? "var(--emerald)" : "var(--paper-3)",
      position: "relative", transition: "background 120ms",
    }}>
      <span style={{
        position: "absolute", top: 2, left: v ? 18 : 2,
        width: 16, height: 16, borderRadius: 999,
        background: "#fff", transition: "left 120ms",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      }} />
    </button>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.automations = AutomationsScreen;
