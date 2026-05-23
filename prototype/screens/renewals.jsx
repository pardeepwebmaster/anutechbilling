/* eslint-disable */
// C8 — Renewals Dashboard with churn-risk scoring

// Risk model — combines multiple signals into a 0-100 score (higher = more at risk)
// Real production would pull from analytics (last login, support tickets, NPS, payment history)
// For prototype: deterministic from sub characteristics so same customer always gets same score
function renewalRisk(sub) {
  let score = 0;
  const reasons = [];

  // Signal 1: Days until renewal (closer = more urgent, but only adds to risk if other signals are bad)
  // We use this as a "deadline pressure" multiplier, not a direct risk signal

  // Signal 2: Seat utilization (used / total) — low usage = churn risk
  const utilization = sub.used / Math.max(1, sub.seats);
  if (utilization < 0.7) {
    score += 35;
    reasons.push(`Low seat usage (${Math.round(utilization * 100)}%)`);
  } else if (utilization < 0.85) {
    score += 15;
    reasons.push(`Moderate seat usage (${Math.round(utilization * 100)}%)`);
  }

  // Signal 3: Plan tier (Starter customers churn more than Plus/Enterprise)
  const plan = (sub.plan || "").toLowerCase();
  if (plan.includes("starter")) {
    score += 20;
    reasons.push("Lower-tier plan (Starter)");
  }
  if (plan.includes("std") && !plan.includes("plus")) {
    score += 5;
  }

  // Signal 4: Mock "last login days" — hash from id for deterministic variation
  const idHash = sub.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 100;
  const lastLoginDays = (idHash * 7) % 60; // 0-60 days
  if (lastLoginDays > 30) {
    score += 25;
    reasons.push(`No admin login for ${lastLoginDays} days`);
  } else if (lastLoginDays > 14) {
    score += 10;
    reasons.push(`Last admin login ${lastLoginDays}d ago`);
  }

  // Signal 5: Mock support tickets — derived from id
  const tickets = (idHash * 3) % 8;
  if (tickets >= 5) {
    score += 20;
    reasons.push(`${tickets} support tickets in last 30 days`);
  } else if (tickets >= 3) {
    score += 8;
    reasons.push(`${tickets} support tickets recently`);
  }

  // Signal 6: Mock NPS score (lower = risk)
  const nps = 9 - (idHash % 10); // 0-9
  if (nps <= 4) {
    score += 25;
    reasons.push(`Low NPS score (${nps}/10)`);
  } else if (nps <= 6) {
    score += 10;
    reasons.push(`Neutral NPS (${nps}/10)`);
  }

  // Clamp
  score = Math.min(100, score);

  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const color = level === "high" ? "danger" : level === "medium" ? "warning" : "success";
  const label = level === "high" ? "HIGH RISK" : level === "medium" ? "Medium" : "Healthy";

  return { score, level, color, label, reasons, lastLoginDays, tickets, nps };
}

function RenewalsScreen() {
  const { toast } = useToast();

  const urgent  = SUBS.filter(s => s.days >= 0 && s.days <= 7);
  const upcoming = SUBS.filter(s => s.days > 7 && s.days <= 30);
  const future  = SUBS.filter(s => s.days > 30 && s.days <= 90);

  const arrAtRisk = SUBS.filter(s => s.days >= 0 && s.days <= 90).reduce((s, x) => s + x.mrr * 12, 0);
  const urgentMrr = urgent.reduce((s, x) => s + x.mrr, 0);
  const upcomingMrr = upcoming.reduce((s, x) => s + x.mrr, 0);
  const futureMrr  = future.reduce((s, x) => s + x.mrr, 0);
  // Risk roll-up across all upcoming renewals
  const upcoming90 = SUBS.filter(s => s.days >= 0 && s.days <= 90);
  const highRiskSubs = upcoming90.filter(s => renewalRisk(s).level === "high");
  const highRiskArr  = highRiskSubs.reduce((s, x) => s + x.mrr * 12, 0);

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Revenue</div>
            <h1 className="page-title">Renewals</h1>
            <p className="page-sub">{SUBS.length} active subscriptions · {rupee(arrAtRisk, { compact: true })} ARR at risk</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="download">Export</Btn>
            <Btn icon="mail" kind="primary" onClick={() => toast("Bulk reminder sent to 12 customers")}>Bulk reminder</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-5" style={{ marginBottom: 24 }}>
        <KPI label="Urgent · ≤7 days"      value={urgent.length}        trend={`${rupee(urgentMrr, { compact: true })} MRR`} trendKind="down" trendIcon="alert" icon="clock" />
        <KPI label="Upcoming · 30 days"    value={upcoming.length}      trend={`${rupee(upcomingMrr, { compact: true })} MRR`} trendKind="neutral" icon="calendar" />
        <KPI label="Future · 31–90 days"   value={future.length}        trend={`${rupee(futureMrr, { compact: true })} MRR`} trendKind="up" trendIcon="trending_up" icon="trending_up" />
        <KPI label="High-Risk Renewals"    value={highRiskSubs.length}  trend={`${rupee(highRiskArr, { compact: true })} ARR at risk`} trendKind="down" trendIcon="alert" icon="alert" />
        <KPI label="Renewal rate"          value="87" unit="%"          trend="+5% YoY" trendKind="up" trendIcon="trending_up" icon="check_circle" />
      </div>

      {/* Gemini AI: next-best-actions for renewals */}
      <GeminiCard
        title="Renewal AI · Next best actions"
        actions={
          <>
            <Btn size="sm" kind="primary" icon="phone" onClick={() => toast("Calling Hotel Royal Group — high-risk save call")}>Save Hotel Royal Group</Btn>
            <Btn size="sm" icon="mail" onClick={() => toast("Sent NPS survey to 5 medium-risk customers")}>Send NPS to medium-risk</Btn>
          </>
        }
      >
        <b style={{ color: "var(--ink)" }}>{highRiskSubs.length} high-risk renewals worth ₹{(highRiskArr/100000).toFixed(1)}L ARR detected.</b> Top priority: <b>Hotel Royal Group</b> — 65% seat usage + NPS 4 + 5 support tickets. Call this week with usage report + upgrade incentive. <b>Cosmo Tech</b> renews in 2 days, no response to emails — try WhatsApp.
      </GeminiCard>

      <RenewalBucket
        kind="rose"
        title="Urgent · Next 7 days"
        sub="Call within 24 hours — every day of delay risks revenue"
        rows={urgent}
        toast={toast}
      />
      <div style={{ height: 20 }} />
      <RenewalBucket
        kind="amber"
        title="Upcoming · Next 30 days"
        sub="Send personalized email + one follow-up call"
        rows={upcoming}
        toast={toast}
      />
      <div style={{ height: 20 }} />
      <RenewalBucket
        kind="emerald"
        title="Future · 31–90 days"
        sub="Drip campaign + value-prop content"
        rows={future}
        toast={toast}
        collapsed
      />
    </div>
  );
}

function RenewalBucket({ kind, title, sub, rows, toast, collapsed = false }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <Card flush>
      <div style={{ padding: "16px 20px", borderBottom: open ? "1px solid var(--hairline)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={`dot ${kind}`} style={{ width: 10, height: 10 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{sub} · <span className="tnum">{rows.length}</span> {rows.length === 1 ? "subscription" : "subscriptions"}</div>
          </div>
        </div>
        <Btn kind="ghost" size="sm" iconRight={open ? "chevron_up" : "chevron_down"} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</Btn>
      </div>
      {open && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Plan</th>
              <th>Vendor</th>
              <th className="right">Seats</th>
              <th>Renewal date</th>
              <th className="right">MRR</th>
              <th>Churn Risk</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const risk = renewalRisk(r);
              return (
              <tr key={r.id}>
                <td><b>{r.cust}</b><div className="sub mono">{r.dom}</div></td>
                <td>{r.plan}</td>
                <td><Vendor name={r.vendor} /></td>
                <td className="right tnum">{r.seats}</td>
                <td>
                  <div>{r.renewal}</div>
                  <div className="sub">
                    {r.days < 0
                      ? <Badge kind="danger" dot>Expired {Math.abs(r.days)}d</Badge>
                      : r.days <= 7
                        ? <Badge kind="danger" dot>{r.days}d</Badge>
                        : r.days <= 30
                          ? <Badge kind="warning" dot>{r.days}d</Badge>
                          : <Badge kind="muted">{r.days}d</Badge>
                    }
                  </div>
                </td>
                <td className="right tnum">{rupee(r.mrr)}</td>
                <td>
                  <Badge kind={risk.color} dot>{risk.label}</Badge>
                  <div className="sub" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, maxWidth: 220, lineHeight: 1.4 }}>
                    {risk.reasons[0] || "All signals nominal"}
                    {risk.reasons.length > 1 && <span style={{ color: risk.color === "danger" ? "var(--rose)" : "var(--amber)" }}> · +{risk.reasons.length - 1} more</span>}
                  </div>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {risk.level === "high" ? (
                      <Btn size="sm" kind="danger" icon="phone" onClick={() => toast(`Urgent call to ${r.cust} — high churn risk`)}>Save</Btn>
                    ) : kind === "rose" ? (
                      <Btn size="sm" kind="primary" icon="phone" onClick={() => toast(`Calling ${r.cust}…`)}>Call</Btn>
                    ) : (
                      <Btn size="sm" icon="mail" onClick={() => toast(`Email queued to ${r.cust}`)}>Email</Btn>
                    )}
                    <IconBtn icon="more_h" />
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.renewals = RenewalsScreen;
