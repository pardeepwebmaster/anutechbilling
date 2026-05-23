/* eslint-disable */
// C4 — Items Catalog

function ItemsScreen() {
  const [tab, setTab] = useState("all");
  const rows = tab === "all" ? ITEMS : ITEMS.filter(i => i.vendor === tab);

  const tabs = [
    { id: "all",       label: "All",         count: ITEMS.length },
    { id: "google",    label: "Google",      count: ITEMS.filter(i => i.vendor === "google").length },
    { id: "microsoft", label: "Microsoft",   count: ITEMS.filter(i => i.vendor === "microsoft").length },
    { id: "zoho",      label: "Zoho",        count: ITEMS.filter(i => i.vendor === "zoho").length },
    { id: "addon",     label: "Add-ons",     count: 8 },
  ];

  const marginTone = (m) => m >= 18 ? "success" : m >= 13 ? "warning" : "danger";

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Catalog</div>
            <h1 className="page-title">Items</h1>
            <p className="page-sub">Master SKU list · pricing · wholesale costs · margins</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="download">Import</Btn>
            <Btn icon="upload">Export</Btn>
            <Btn icon="plus" kind="primary">Add SKU</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-5" style={{ marginBottom: 24 }}>
        <KPI label="Total SKUs"        value={ITEMS.length} icon="package" />
        <KPI label="Google plans"      value={ITEMS.filter(i => i.vendor === "google").length} />
        <KPI label="Microsoft plans"   value={ITEMS.filter(i => i.vendor === "microsoft").length} />
        <KPI label="Zoho plans"        value={ITEMS.filter(i => i.vendor === "zoho").length} />
        <KPI label="Avg margin"        value="18" unit="%" trend="+1.2% vs Q1" trendKind="up" trendIcon="trending_up" />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <Card flush>
        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th><th>SKU</th><th>HSN</th>
              <th className="right">MSRP</th><th className="right">Wholesale</th><th className="right">Margin</th>
              <th>Stock</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(it => (
              <tr key={it.id}>
                <td><b>{it.name}</b><div className="sub"><Vendor name={it.vendor} /></div></td>
                <td className="mono" style={{ fontSize: 12 }}>{it.id}</td>
                <td className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{it.hsn}</td>
                <td className="right tnum">{rupee(it.msrp)}/mo</td>
                <td className="right tnum" style={{ color: "var(--ink-3)" }}>{rupee(it.wholesale)}/mo</td>
                <td className="right"><Badge kind={marginTone(it.margin)}>{it.margin}%</Badge></td>
                <td style={{ color: "var(--ink-3)", fontSize: 12 }}>Unlimited</td>
                <td><IconBtn icon="edit" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card style={{ marginTop: 24, borderColor: "var(--amber)", background: "var(--amber-soft)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="card-title" style={{ color: "var(--amber-ink)" }}>
              <I name="alert" /> 3 SKUs have pending MSRP price changes
            </div>
            <div className="card-sub">Google updated pricing for Plus, Voice Standard, AppSheet — effective 1 Jun 2026</div>
          </div>
          <Btn kind="accent">Review changes</Btn>
        </div>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.items = ItemsScreen;
