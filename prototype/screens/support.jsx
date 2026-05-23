/* eslint-disable */
// C9 — Support Center (internal)

const TICKETS = [
  { id: "#0143", cust: "Echo Pharma",       subj: "Email not sending to external domains",     prio: "urgent", owner: "priya",  age: "1h", sla: "ok" },
  { id: "#0142", cust: "Acme Corp",         subj: "Unable to add user — license limit",        prio: "medium", owner: "priya",  age: "2h", sla: "ok" },
  { id: "#0141", cust: "Hi-Tech Solutions", subj: "SSO not working with Google Workspace",     prio: "urgent", owner: "rahul",  age: "4h", sla: "warn" },
  { id: "#0140", cust: "Foxtrot Logistics", subj: "Migration from O365 — calendar invites missing", prio: "medium", owner: "amit",   age: "5h", sla: "ok" },
  { id: "#0139", cust: "Golf Resorts",      subj: "Workspace admin password reset",            prio: "low",    owner: "rahul",  age: "8h", sla: "ok" },
  { id: "#0138", cust: "Cosmo Tech",        subj: "DMARC report query",                         prio: "medium", owner: "amit",   age: "1d", sla: "breached" },
];

function SupportScreen() {
  const [tab, setTab] = useState("all");
  const tabs = [
    { id: "all", label: "All open", count: TICKETS.length },
    { id: "urgent", label: "Urgent", count: TICKETS.filter(t=>t.prio==="urgent").length, dot: "rose" },
    { id: "medium", label: "Medium", count: TICKETS.filter(t=>t.prio==="medium").length, dot: "amber" },
    { id: "low",    label: "Low",    count: TICKETS.filter(t=>t.prio==="low").length, dot: "emerald" },
    { id: "sla",    label: "SLA risk", count: TICKETS.filter(t=>t.sla!=="ok").length },
  ];

  const rows = TICKETS.filter(t =>
    tab === "all" ? true :
    tab === "sla" ? t.sla !== "ok" :
    t.prio === tab
  );

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Engage</div>
            <h1 className="page-title">Support</h1>
            <p className="page-sub">Internal view — manage all customer tickets</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="book">Knowledge base</Btn>
            <Btn icon="plus" kind="primary">Manual ticket</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-5" style={{ marginBottom: 24 }}>
        <KPI label="Open tickets"   value="12" icon="ticket" />
        <KPI label="Avg response"   value="2.3" unit="h" trend="−45m faster" trendKind="up" trendIcon="trending_down" />
        <KPI label="SLA breached"   value="1"  trend="+1 today" trendKind="down" trendIcon="alert" />
        <KPI label="CSAT"           value="4.8" unit="/5" icon="smile" />
        <KPI label="Resolved · MTD" value="87"  trend="+12%" trendKind="up" trendIcon="trending_up" />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <Card flush>
        <table className="tbl">
          <thead><tr><th>Ticket</th><th>Customer</th><th>Subject</th><th>Priority</th><th>Assigned</th><th>Age</th><th>SLA</th><th></th></tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id}>
                <td className="mono" style={{ fontSize: 12 }}>{t.id}</td>
                <td>{t.cust}</td>
                <td>{t.subj}</td>
                <td>
                  {t.prio === "urgent" && <Badge kind="danger" dot>Urgent</Badge>}
                  {t.prio === "medium" && <Badge kind="warning" dot>Medium</Badge>}
                  {t.prio === "low"    && <Badge kind="success" dot>Low</Badge>}
                </td>
                <td><Avatar initials={TEAM[t.owner].initials} color={TEAM[t.owner].color} size="sm" /></td>
                <td className="tnum" style={{ color: "var(--ink-3)" }}>{t.age}</td>
                <td>
                  {t.sla === "ok"       && <Badge kind="success" dot>OK</Badge>}
                  {t.sla === "warn"     && <Badge kind="warning" dot>Approaching</Badge>}
                  {t.sla === "breached" && <Badge kind="danger"  dot>Breached</Badge>}
                </td>
                <td><Btn size="sm" iconRight="arrow_right" kind="ghost">Open</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.support = SupportScreen;
