/* eslint-disable */
// C6 — Invoices

function InvoicesScreen() {
  const [tab, setTab] = useState("all");
  const { toast } = useToast();

  const tabs = [
    { id: "all",     label: "All",     count: INVOICES.length },
    { id: "paid",    label: "Paid",    count: INVOICES.filter(i => i.status === "paid").length, dot: "emerald" },
    { id: "pending", label: "Pending", count: INVOICES.filter(i => i.status === "pending").length, dot: "amber" },
    { id: "overdue", label: "Overdue", count: INVOICES.filter(i => i.status === "overdue").length, dot: "rose" },
    { id: "draft",   label: "Draft",   count: 3 },
  ];

  const rows = INVOICES.filter(i => tab === "all" || i.status === tab);

  const outstanding = INVOICES.filter(i => i.status !== "paid").reduce((s, i) => s + i.amt, 0);
  const overdue = INVOICES.filter(i => i.status === "overdue").reduce((s, i) => s + i.amt, 0);

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Revenue</div>
            <h1 className="page-title">Invoices</h1>
            <p className="page-sub">All invoices · Auto-sync with Zoho Books</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="upload">Export GSTR-1</Btn>
            <Btn icon="refresh">Push to Zoho</Btn>
            <Btn icon="plus" kind="primary">New invoice</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-5" style={{ marginBottom: 24 }}>
        <KPI label="Outstanding"     value={rupee(outstanding, { compact: true })} trend={`${INVOICES.filter(i => i.status !== "paid").length} invoices`} trendKind="down" trendIcon="alert" icon="receipt" />
        <KPI label="Overdue"         value={rupee(overdue, { compact: true })}     trend={`${INVOICES.filter(i=>i.status==="overdue").length} aging`} trendKind="down" trendIcon="alert" />
        <KPI label="Collected · MTD" value="₹12.4L"                                  trend="+18%" trendKind="up" trendIcon="trending_up" icon="trending_up" />
        <KPI label="Margin · MTD"    value="₹2.1L"                                   trend="17% avg" trendKind="up" trendIcon="trending_up" icon="rupee" />
        <KPI label="Avg collection"  value="12" unit=" days"                         trend="−3d faster" trendKind="up" trendIcon="trending_down" icon="clock" />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <Card flush>
        <table className="tbl">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Invoice #</th><th>Customer</th><th>Date</th><th>Due date</th>
              <th className="right">Amount</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(inv => (
              <tr key={inv.id}>
                <td><input type="checkbox" /></td>
                <td className="mono" style={{ fontSize: 12 }}>{inv.id}</td>
                <td>{inv.cust}</td>
                <td>{inv.date}</td>
                <td>{inv.due}</td>
                <td className="right tnum">{rupee(inv.amt)}</td>
                <td>
                  {inv.status === "paid"    && <Badge kind="success" dot>Paid</Badge>}
                  {inv.status === "pending" && <Badge kind="warning" dot>Pending</Badge>}
                  {inv.status === "overdue" && <Badge kind="danger"  dot>Overdue {inv.overdueDays}d</Badge>}
                </td>
                <td>
                  {inv.status === "paid"
                    ? <Btn size="sm" icon="download" kind="ghost">PDF</Btn>
                    : inv.status === "overdue"
                      ? <Btn size="sm" kind="danger" icon="phone" onClick={() => toast(`Calling ${inv.cust}…`)}>Call</Btn>
                      : <Btn size="sm" icon="mail" onClick={() => toast(`Reminder emailed to ${inv.cust}`)}>Remind</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="card-title">Auto-Sync Status</div>
            <div className="card-sub">Last synced with Zoho Books: 2 minutes ago · 47 / 47 invoices in sync</div>
          </div>
          <Badge kind="success" dot>Healthy</Badge>
        </div>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.invoices = InvoicesScreen;
