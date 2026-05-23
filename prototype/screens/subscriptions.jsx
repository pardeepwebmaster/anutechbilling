/* eslint-disable */
// C7 — Subscriptions

function SubscriptionsScreen() {
  const [tab, setTab] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [addSeatsFor, setAddSeatsFor] = useState(null);

  const tabs = [
    { id: "all",      label: "All",          count: SUBS.length },
    { id: "active",   label: "Active",       count: SUBS.filter(s => s.status === "active").length, dot: "emerald" },
    { id: "expiring", label: "Expiring 30d", count: SUBS.filter(s => s.days >= 0 && s.days <= 30).length, dot: "amber" },
    { id: "expired",  label: "Expired",      count: SUBS.filter(s => s.status === "expired").length, dot: "rose" },
    { id: "recon",    label: "Reconciliation", count: 1 },
  ];

  const filtered = SUBS.filter(s => {
    if (tab === "active" && s.status !== "active") return false;
    if (tab === "expiring" && (s.days < 0 || s.days > 30)) return false;
    if (tab === "expired" && s.status !== "expired") return false;
    if (vendor !== "all" && s.vendor !== vendor) return false;
    return true;
  });

  const activeMRR = SUBS.filter(s => s.status === "active").reduce((s, x) => s + x.mrr, 0);
  const activeSeats = SUBS.reduce((s, x) => s + x.seats, 0);
  // Margin aggregates — the reseller's edge
  const monthlyMargin = SUBS.filter(s => s.status === "active").reduce((acc, s) => acc + subMargin(s).margin, 0);
  const annualMargin  = monthlyMargin * 12;
  const avgMarginPct  = SUBS.length
    ? Math.round(SUBS.filter(s => s.status === "active").reduce((acc, s) => acc + subMargin(s).marginPct, 0) / Math.max(1, SUBS.filter(s => s.status === "active").length))
    : 0;

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Revenue</div>
            <h1 className="page-title">Subscriptions</h1>
            <p className="page-sub">All active + expired across vendors · Auto-synced</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="refresh">Sync vendors</Btn>
            <Btn icon="download">Export</Btn>
            <Btn icon="plus" kind="primary">Manual add</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-6" style={{ marginBottom: 24 }}>
        <KPI label="Total subs"        value={SUBS.length}                                  trend="+4 this month"    trendKind="up"   trendIcon="trending_up" />
        <KPI label="Active MRR"        value={rupee(activeMRR, { compact: true })}          trend="+12%"             trendKind="up"   trendIcon="trending_up" />
        <KPI label="Active ARR"        value={rupee(activeMRR * 12, { compact: true })}     trend="+14%"             trendKind="up"   trendIcon="trending_up" />
        <KPI label="Your Margin (ARR)" value={rupee(annualMargin, { compact: true })}       trend={`Avg ${avgMarginPct}% per sub`} trendKind="up" trendIcon="trending_up" icon="rupee" />
        <KPI label="Total seats"       value={activeSeats}                                  trend="782 active, 65 unused" />
        <KPI label="At risk"           value="5"                                            trend="₹38K MRR"        trendKind="down" trendIcon="alert" />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Segmented value={vendor} onChange={setVendor} options={[
          { value: "all", label: "All Vendors" },
          { value: "google", label: "Google" },
          { value: "microsoft", label: "Microsoft" },
          { value: "zoho", label: "Zoho" },
        ]} />
        <div className="topbar-search" style={{ width: 240, padding: "5px 10px" }}>
          <I name="search" size={13} />
          <input placeholder="Customer or domain…" />
        </div>
      </div>

      <Card flush>
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer · Domain</th><th>Plan</th><th>Vendor</th>
              <th className="right">Seats</th><th className="right">MRR</th>
              <th className="right" title="Your monthly margin (price − wholesale cost)">Margin</th>
              <th>Started</th><th>Renewal</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const m = subMargin(s);
              const marginTone = m.marginPct >= 18 ? "var(--emerald)" : m.marginPct >= 14 ? "var(--amber)" : "var(--rose)";
              return (
              <tr key={s.id}>
                <td><b>{s.cust}</b><div className="sub mono">{s.dom}</div></td>
                <td>{s.plan}</td>
                <td><Vendor name={s.vendor} /></td>
                <td className="right tnum">{s.seats} <span style={{ color: "var(--ink-3)" }}>({s.used})</span></td>
                <td className="right tnum">{rupee(s.mrr)}</td>
                <td className="right tnum" style={{ color: marginTone, fontWeight: 500 }}>
                  {rupee(m.margin)}
                  <div className="sub" style={{ color: "var(--ink-3)" }}>{m.marginPct}%</div>
                </td>
                <td>{s.start}</td>
                <td>
                  {s.renewal}
                  {s.urgent && <div className="sub"><Badge kind="danger" dot>{s.days}d</Badge></div>}
                </td>
                <td>
                  {s.status === "expired"
                    ? <Badge kind="danger" dot>Expired {Math.abs(s.days)}d</Badge>
                    : <Badge kind="success" dot>Active</Badge>}
                </td>
                <td>
                  {s.status === "expired"
                    ? <Btn size="sm" kind="danger" icon="alert">Action</Btn>
                    : s.urgent
                      ? <div style={{ display: "flex", gap: 4 }}>
                          <Btn size="sm" kind="primary" icon="phone">Renew</Btn>
                          <IconBtn icon="plus" title="Add seats (pro-rata)" onClick={() => setAddSeatsFor(s)} />
                        </div>
                      : <Btn size="sm" icon="plus" onClick={() => setAddSeatsFor(s)}>Seats</Btn>}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <Card title="Vendor Reconciliation" sub="Compare our records vs vendor API · last sync 5 min ago">
          <div className="stack-12">
            <ReconRow vendor="google"    label="Google Reseller API"     status="32 / 32 matched" tone="emerald" />
            <ReconRow vendor="microsoft" label="Microsoft Partner Center" status="10 / 10 matched" tone="emerald" />
            <ReconRow vendor="zoho"      label="Zoho Workplace"           status="4 / 5 · 1 mismatch" tone="amber" />
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
              <span style={{ color: "var(--ink-3)", fontSize: 12 }}>Total discrepancies</span>
              <Badge kind="warning" dot>1 needs review</Badge>
            </div>
            <Btn icon="alert" kind="default">Review discrepancy</Btn>
          </div>
        </Card>

        <Card title="Subscriptions by Plan">
          <div className="stack-12">
            {[
              ["Google Workspace Plus",      14, 190000],
              ["Google Workspace Standard",  12, 89000],
              ["Google Workspace Starter",    5, 14000],
              ["Google Enterprise",           1, 115000],
              ["Microsoft 365 Business Std",  8, 78000],
              ["Zoho + Add-ons",              7, 35000],
            ].map(([name, subs, mrr]) => (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "1fr 90px 60px", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13 }}>{name}</div>
                <div className="bar"><i style={{ width: Math.min(100, (mrr/200000)*100) + "%", background: "var(--ink)" }} /></div>
                <div className="tnum serif" style={{ fontSize: 14, textAlign: "right" }}>{rupee(mrr, { compact: true })}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {addSeatsFor && (
        <AddSeatsModal sub={addSeatsFor} onClose={() => setAddSeatsFor(null)} />
      )}
    </div>
  );
}

function AddSeatsModal({ sub, onClose }) {
  const { toast } = useToast();
  const [newSeats, setNewSeats] = useState(5);

  const perSeatMonthly = Math.round(sub.mrr / sub.seats);
  const perSeatDaily = (perSeatMonthly * 12) / 365;
  const days = sub.days; // days until renewal
  const proRataPerSeat = Math.round(perSeatDaily * days);
  const subtotal = proRataPerSeat * newSeats;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Add seats · pro-rata</div>
            <div className="sub" style={{ fontSize: 12 }}>Co-term with existing renewal · {sub.renewal}</div>
          </div>
          <IconBtn icon="x" onClick={onClose} />
        </div>
        <div className="modal-body" style={{ padding: "16px 20px" }}>
          <div style={{ background: "var(--paper-2)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{sub.cust}</div>
            <div className="sub" style={{ fontSize: 12 }}>{sub.plan} · {sub.seats} seats @ {rupee(perSeatMonthly)}/seat/mo</div>
          </div>

          <Field label="Add how many seats?">
            <input
              className="input tnum"
              type="number"
              min={1}
              value={newSeats}
              onChange={(e) => setNewSeats(Math.max(1, +e.target.value || 1))}
              style={{ width: 100 }}
            />
          </Field>

          <div style={{ marginTop: 16, fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
            <I name="info" size={11} />
            Charged from {todayLabel} → {sub.renewal} ({days} days). Per-seat daily rate = monthly × 12 ÷ 365.
          </div>

          <div className="stack-8" style={{ background: "var(--paper-2)", padding: 16, borderRadius: 10, marginTop: 16 }}>
            <Row label={`Per-seat daily rate`} value={rupee(Math.round(perSeatDaily))} />
            <Row label={`Pro-rata per seat (${days} days)`} value={rupee(proRataPerSeat)} />
            <Row label={`× ${newSeats} new seats`} value={rupee(subtotal)} />
            <Row label="GST (18%)" value={rupee(tax)} muted />
            <div style={{ borderTop: "1px solid var(--hairline-strong)", paddingTop: 10, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-3)", fontWeight: 600 }}>One-time pro-rata charge</span>
                <span className="serif tnum" style={{ fontSize: 24, color: "var(--amber)" }}>{rupee(total)}</span>
              </div>
              <div className="sub" style={{ fontSize: 11, marginTop: 4 }}>
                Then {newSeats + sub.seats} seats × {rupee(perSeatMonthly)}/mo from next renewal cycle
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--hairline)" }}>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="default" icon="file" onClick={() => { toast(`Pro-rata quote drafted for ${sub.cust} · ${rupee(total)}`); onClose(); }}>
            Save as quote
          </Btn>
          <Btn kind="primary" icon="send" onClick={() => { toast(`Pro-rata invoice sent to ${sub.cust} · ${rupee(total)}`); onClose(); }}>
            Send invoice
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: muted ? "var(--ink-3)" : undefined }}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

function ReconRow({ vendor, label, status, tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Vendor name={vendor} />
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{label}</span>
      <Badge kind={tone === "emerald" ? "success" : "warning"} dot>{status}</Badge>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.subscriptions = SubscriptionsScreen;
