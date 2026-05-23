/* eslint-disable */
// E2 — Project Plan & Timeline

function TimelineScreen() {
  const phases = [
    { id: 1, name: "Foundation",       weeks: "Week 1–2", color: "indigo",  tasks: ["Data cleanup", "Team roles audit", "Dashboard customized", "Email templates", "SOPs published"], milestone: "M1: Cleanup signed off" },
    { id: 2, name: "Sales Pipeline",   weeks: "Week 3–4", color: "amber",   tasks: ["Leads Kanban module", "Activity timeline", "Tasks & assignments", "Customer 360", "Mobile responsive"], milestone: "M2: Leads + activities live" },
    { id: 3, name: "Automation",       weeks: "Week 5–6", color: "rose",    tasks: ["Rule engine", "12 pre-built rules", "Renewal alerts", "Auto-email + receipts", "Reports module"], milestone: "M3: Automation passing UAT" },
    { id: 4, name: "Engagement",       weeks: "Week 7–8", color: "emerald", tasks: ["WhatsApp integration", "Customer portal", "Onboarding wizard", "Campaigns", "Final UAT + training"], milestone: "M4: Go-live" },
  ];

  return (
    <div className="content" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 28, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Client demo view</b> · 8-week delivery plan</span>
        <Badge kind="info">E2 · Timeline</Badge>
      </div>

      <div className="page-head">
        <div className="page-eyebrow">Project plan</div>
        <h1 className="page-title">8 weeks. 4 phases. 4 milestones.</h1>
        <p className="page-sub">Phased delivery with sign-offs at the end of each phase. Pay only when each milestone is signed.</p>
      </div>

      {/* Phase strip */}
      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        {phases.map(p => (
          <div key={p.id} style={{
            border: `1px solid var(--hairline)`,
            background: `var(--${p.color}-soft)`,
            borderRadius: 10,
            padding: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: `var(--${p.color})`, textTransform: "uppercase", letterSpacing: "0.1em" }}>Phase {p.id} · {p.weeks}</div>
            <div className="serif" style={{ fontSize: 22, color: "var(--ink)", marginTop: 6 }}>{p.name}</div>
          </div>
        ))}
      </div>

      {/* Gantt */}
      <Card title="Gantt view" sub="Visual schedule across 8 weeks" style={{ marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--hairline)" }}>
          <div className="field-label">Task</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ fontSize: 10, color: "var(--ink-3)", textAlign: "center", fontWeight: 600 }}>W{i+1}</div>
            ))}
          </div>
        </div>

        <div className="stack-8">
          {[
            { task: "Data cleanup + RBAC",       phase: 1, start: 0, end: 2, color: "indigo" },
            { task: "SOPs + Email templates",     phase: 1, start: 0, end: 2, color: "indigo" },
            { task: "Leads Kanban module",        phase: 2, start: 2, end: 4, color: "amber" },
            { task: "Activity timeline",           phase: 2, start: 2, end: 4, color: "amber" },
            { task: "Automation engine",           phase: 3, start: 4, end: 6, color: "rose" },
            { task: "Auto-email + renewals",       phase: 3, start: 4, end: 6, color: "rose" },
            { task: "WhatsApp integration",        phase: 4, start: 6, end: 8, color: "emerald" },
            { task: "Customer portal",              phase: 4, start: 6, end: 8, color: "emerald" },
          ].map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "200px 1fr", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 12 }}>{t.task}</div>
              <div style={{ position: "relative", height: 22, background: "var(--paper-2)", borderRadius: 6 }}>
                <div style={{
                  position: "absolute",
                  left: `${(t.start/8)*100}%`,
                  width: `${((t.end-t.start)/8)*100}%`,
                  top: 2, bottom: 2,
                  background: `var(--${t.color})`,
                  borderRadius: 4,
                  fontSize: 10, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                }}>W{t.start+1}–W{t.end}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Phase detail */}
      <div className="grid grid-2" style={{ marginBottom: 32 }}>
        {phases.map(p => (
          <Card key={p.id}>
            <div className="row" style={{ gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `var(--${p.color}-soft)`, color: `var(--${p.color})`, display: "grid", placeItems: "center" }}>
                <span className="serif" style={{ fontSize: 18 }}>{p.id}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Phase {p.id} · {p.weeks}</div>
                <div className="serif" style={{ fontSize: 22 }}>{p.name}</div>
              </div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {p.tasks.map(t => (
                <li key={t} className="row" style={{ gap: 8, fontSize: 13 }}>
                  <I name="check" size={13} style={{ color: `var(--${p.color})` }} />
                  {t}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 16, padding: "10px 12px", background: "var(--paper-2)", borderRadius: 8, fontSize: 12 }}>
              <b>{p.milestone}</b>
            </div>
          </Card>
        ))}
      </div>

      {/* Payment schedule */}
      <Card title="Milestone-based payment schedule" sub="No upfront lump-sum. Pay as we hit each milestone.">
        <table className="tbl">
          <thead><tr><th>Milestone</th><th>Deliverable</th><th>Sign-off by</th><th className="right">Payment</th></tr></thead>
          <tbody>
            <tr><td><b>Kick-off</b></td><td>Project start, planning</td><td>Day 0</td><td className="right serif tnum" style={{ fontSize: 16 }}>25%</td></tr>
            <tr><td><b>M1 · Foundation</b></td><td>Cleanup + SOPs + Roles</td><td>End Week 2</td><td className="right serif tnum" style={{ fontSize: 16 }}>15%</td></tr>
            <tr><td><b>M2 · Sales Pipeline</b></td><td>Leads + Activities + Tasks</td><td>End Week 4</td><td className="right serif tnum" style={{ fontSize: 16 }}>20%</td></tr>
            <tr><td><b>M3 · Automation</b></td><td>Rule engine + 12 rules</td><td>End Week 6</td><td className="right serif tnum" style={{ fontSize: 16 }}>20%</td></tr>
            <tr><td><b>M4 · Go-Live</b></td><td>WhatsApp + Portal + UAT</td><td>End Week 8</td><td className="right serif tnum" style={{ fontSize: 16 }}>20%</td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.timeline = TimelineScreen;
