/* eslint-disable */
// C3 — Customers (list + 360 detail view with activity timeline)

function CustomersScreen() {
  const [selectedId, setSelectedId] = useState(window.__currentCustomer || null);

  useEffect(() => {
    if (window.__currentCustomer && window.__currentCustomer !== selectedId) {
      setSelectedId(window.__currentCustomer);
    }
  }, []);

  const openCustomer = (id) => {
    window.__currentCustomer = id;
    setSelectedId(id);
  };

  const backToList = () => {
    delete window.__currentCustomer;
    setSelectedId(null);
  };

  if (selectedId) {
    const c = CUSTOMERS.find(cu => cu.id === selectedId);
    if (c) return <CustomerDetailScreen customer={c} onBack={backToList} />;
  }

  return <CustomerListScreen onSelect={openCustomer} />;
}

function CustomerListScreen({ onSelect }) {
  const [query, setQuery] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");

  const filtered = CUSTOMERS.filter(c => {
    if (managerFilter !== "all" && c.manager !== managerFilter) return false;
    if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.domain.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const totalMRR = CUSTOMERS.reduce((s, c) => s + c.mrr, 0);
  const totalARR = CUSTOMERS.reduce((s, c) => s + c.arr, 0);
  const avgHealth = Math.round(CUSTOMERS.reduce((s, c) => s + c.health, 0) / CUSTOMERS.length);
  const atRisk = CUSTOMERS.filter(c => c.health < 75).length;

  const healthBadge = (h) => {
    if (h >= 85) return <Badge kind="success" dot>Healthy</Badge>;
    if (h >= 70) return <Badge kind="warning" dot>Watch</Badge>;
    return <Badge kind="danger" dot>At risk</Badge>;
  };

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Workspace</div>
            <h1 className="page-title">Customers</h1>
            <p className="page-sub"><span className="tnum">{CUSTOMERS.length}</span> active customers · <span className="tnum">{rupee(totalARR, { compact: true })}</span> ARR · Avg health <span className="tnum">{avgHealth}</span>/100</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="download">Export</Btn>
            <Btn icon="plus" kind="primary">Add customer</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KPI label="Active customers" value={CUSTOMERS.length} trend="+3 this quarter" trendKind="up" trendIcon="trending_up" icon="users" />
        <KPI label="Total MRR"         value={rupee(totalMRR, { compact: true })} trend="+12% YoY" trendKind="up" trendIcon="trending_up" icon="rupee" />
        <KPI label="Total ARR"         value={rupee(totalARR, { compact: true })} trend="+14% YoY" trendKind="up" trendIcon="trending_up" icon="trending_up" />
        <KPI label="At-risk accounts"  value={atRisk} trend={atRisk > 0 ? "needs attention" : "all healthy"} trendKind={atRisk > 0 ? "down" : "up"} trendIcon={atRisk > 0 ? "alert" : "check_circle"} icon="alert" />
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Segmented value={managerFilter} onChange={setManagerFilter} options={[
          { value: "all",     label: "All managers" },
          { value: "rahul",   label: "Rahul" },
          { value: "priya",   label: "Priya" },
          { value: "amit",    label: "Amit" },
        ]} />
        <div className="topbar-search" style={{ width: 280, padding: "5px 10px" }}>
          <I name="search" size={13} />
          <input placeholder="Customer or domain…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <Card flush>
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Since</th>
              <th>State</th>
              <th className="right">MRR</th>
              <th className="right">ARR</th>
              <th className="right">Health</th>
              <th>Renewal</th>
              <th>Account manager</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const mgr = TEAM[c.manager];
              return (
                <tr key={c.id} onClick={() => onSelect(c.id)} style={{ cursor: "pointer" }}>
                  <td>
                    <b>{c.name}</b>
                    <div className="sub mono" style={{ fontSize: 11 }}>{c.domain}</div>
                  </td>
                  <td>{c.since}</td>
                  <td><span style={{ fontSize: 12 }}>{c.state}</span></td>
                  <td className="right tnum">{rupee(c.mrr)}</td>
                  <td className="right tnum" style={{ fontWeight: 500 }}>{rupee(c.arr, { compact: true })}</td>
                  <td className="right">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <span className="tnum" style={{ fontSize: 13, fontWeight: 500 }}>{c.health}</span>
                      {healthBadge(c.health)}
                    </div>
                  </td>
                  <td>{c.renewal}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar initials={mgr.initials} color={mgr.color} size="sm" />
                      <span style={{ fontSize: 12 }}>{mgr.name.split(" ")[0]}</span>
                    </div>
                  </td>
                  <td><I name="chevron_right" size={14} style={{ color: "var(--ink-3)" }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <I name="info" size={11} />
        Click any row to open the Customer 360 view with full activity timeline, subscriptions, and contacts.
      </div>
    </div>
  );
}

function CustomerDetailScreen({ customer, onBack }) {
  const c = customer;
  const [tab, setTab] = useState("activities");
  const { go } = useRouter();

  const tabs = [
    { id: "overview",    label: "Overview" },
    { id: "subscriptions", label: "Subscriptions", count: 2 },
    { id: "quotes",      label: "Quotes",     count: 4 },
    { id: "invoices",    label: "Invoices",   count: 7 },
    { id: "activities",  label: "Activities", count: 28 },
    { id: "files",       label: "Files",      count: 6 },
  ];

  const groups = [
    { id: "today",    label: "Today",     items: ACTIVITIES.filter(a => a.group === "today") },
    { id: "yesterday",label: "Yesterday", items: ACTIVITIES.filter(a => a.group === "yesterday") },
    { id: "last_week",label: "Last week", items: ACTIVITIES.filter(a => a.group === "last_week") },
  ];

  return (
    <div className="content wide" style={{ padding: "28px 40px 80px" }}>
      {/* Header */}
      <div className="page-head">
        <div className="page-head-row">
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <Btn kind="ghost" icon="arrow_left" onClick={onBack} />
            <div>
              <div className="page-eyebrow">Customer · since {c.since}</div>
              <h1 className="page-title">{c.name}</h1>
              <p className="page-sub">{c.domain} · {c.state}</p>
            </div>
          </div>
          <div className="page-head-actions">
            <Btn icon="message" kind="default">Note</Btn>
            <Btn icon="phone">Log call</Btn>
            <Btn icon="edit" kind="default">Edit</Btn>
            <Btn icon="plus" kind="primary">New activity</Btn>
          </div>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 24 }}>
        <Card title="Business Information">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 12, columnGap: 24, fontSize: 13 }}>
            <Stat label="Legal name"     value={c.name} />
            <Stat label="Domain"         value={c.domain} mono />
            <Stat label="GSTIN"          value={c.gstin} mono />
            <Stat label="State"          value={c.state} />
            <Stat label="Primary contact" value={`${c.contact.name} · ${c.contact.title}`} />
            <Stat label="Email"          value={c.contact.email} mono />
            <Stat label="Phone"          value={c.contact.phone} mono />
            <Stat label="Account manager" value={TEAM[c.manager].name} />
          </div>
        </Card>

        <Card title="Health & Revenue">
          <div style={{ textAlign: "center", padding: "8px 0 18px" }}>
            <div className="serif" style={{ fontSize: 56, lineHeight: 1, color: "var(--emerald)" }}>
              {c.health}<span style={{ fontSize: 22, color: "var(--ink-3)" }}>/100</span>
            </div>
            <Badge kind="success" dot>Healthy</Badge>
          </div>
          <div className="stack-8">
            <KVRow label="MRR"        value={rupee(c.mrr)} />
            <KVRow label="ARR"        value={rupee(c.arr)} />
            <KVRow label="Renewal"    value={c.renewal} />
            <KVRow label="Tenure"     value="2y 8mo" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "activities" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 280px" }}>
          <Card>
            <div className="stack-24">
              {groups.map(g => (
                <div key={g.id}>
                  <div className="rail-label" style={{ padding: "0 0 12px" }}>{g.label}</div>
                  <div className="timeline">
                    {g.items.map((a, i) => (
                      <div key={i} className="t-item">
                        <div className="t-icon" style={{ background: `var(--${a.iconBg}-soft)`, color: `var(--${a.iconBg})` }}>
                          <I name={a.icon} size={13} />
                        </div>
                        <div className="t-body">
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>{a.meta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="stack-16">
            <Card title="Add activity" tight>
              <div className="stack-8">
                {[
                  ["phone", "Log call"],
                  ["mail", "Send email"],
                  ["whatsapp", "WhatsApp"],
                  ["file", "Add note"],
                  ["calendar", "Schedule meeting"],
                ].map(([icon, label]) => (
                  <button key={label} className="nav-item">
                    <I name={icon} className="ico" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Key contacts" tight>
              <div className="stack-12">
                <ContactRow name={c.contact.name} role={c.contact.title} initials="RK" />
                <ContactRow name="Anita S" role="Finance" initials="AS" color="indigo" />
                <ContactRow name="Vikram M" role="IT Lead" initials="VM" color="emerald" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "overview" && (
        <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <Card title="Recent Activity" sub="Last 30 days" actions={<Btn size="sm" kind="ghost" iconRight="arrow_right" onClick={() => setTab("activities")}>See all</Btn>}>
            <ActivityTimeline events={[
              { icon: "phone",    kind: "indigo",  title: "Call with Rajesh — discussed Plus upgrade",
                body: "Outcome: positive · Next: revised quote by 2 PM",
                time: "Today · 11:30 AM", actor: "Rahul B" },
              { icon: "rupee",    kind: "emerald", title: "Payment received · ₹3.05L",
                body: "Invoice INV-2026-0156 paid via Razorpay UPI",
                time: "Today · 09:42 AM" },
              { icon: "file",     kind: "amber",   title: "Quote viewed (3rd time)",
                body: "Q-2026-0042 — Plus + Voice upgrade · ₹4.9L",
                time: "Yesterday · 04:15 PM" },
              { icon: "mail",     kind: "indigo",  title: "Email sent: \"Workspace plan upgrade options\"",
                time: "Yesterday · 11:20 AM", actor: "Rahul B" },
              { icon: "refresh",  kind: "emerald", title: "Status changed: Trial Active → Quote Sent",
                time: "Yesterday · 10:50 AM" },
              { icon: "edit",     kind: "amber",   title: "Note added",
                body: "\"Decision maker = CTO Rajesh, not founder. Budget approved ₹3L.\"",
                time: "3 days ago", actor: "Rahul B" },
              { icon: "users",    kind: "indigo",  title: "Demo scheduled — Mumbai office",
                body: "4 attendees · Outcome: strong interest in Plus",
                time: "Last week" },
            ]} />
          </Card>

          <div className="stack-16">
            <Card title="Notes" tight>
              <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55, padding: "0 4px" }}>
                <p><b>Decision maker:</b> CTO Rajesh (not the founder)</p>
                <p><b>Budget:</b> ₹3L approved annually</p>
                <p><b>Pain points:</b> M365 → migration urgency due to renewal Sep 2026</p>
                <p style={{ marginTop: 12, fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>Last updated 3 days ago by Rahul B</p>
              </div>
            </Card>
            <Card title="Open Tasks" tight>
              <div className="stack-8">
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" defaultChecked />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, textDecoration: "line-through", color: "var(--ink-3)" }}>Send revised quote by 2 PM</div>
                    <div style={{ fontSize: 10, color: "var(--ink-3)" }}>Today · Rahul B</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12 }}>Follow up on quote response</div>
                    <div style={{ fontSize: 10, color: "var(--ink-3)" }}>Tomorrow · Rahul B</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12 }}>Schedule M365 → Workspace migration window</div>
                    <div style={{ fontSize: 10, color: "var(--ink-3)" }}>Next week · Rahul B</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === "subscriptions" && (
        <Card>
          <table className="tbl">
            <thead><tr><th>Plan</th><th>Vendor</th><th className="right">Seats</th><th className="right">MRR</th><th>Renewal</th><th></th></tr></thead>
            <tbody>
              {SUBS.filter(s => s.cust === c.name || c.name.startsWith(s.cust) || s.cust.startsWith(c.name)).map(s => (
                <tr key={s.id}>
                  <td><b>{s.plan}</b><div className="sub">{s.dom}</div></td>
                  <td><Vendor name={s.vendor} /></td>
                  <td className="right tnum">{s.seats}</td>
                  <td className="right tnum">{rupee(s.mrr)}</td>
                  <td>{s.renewal}</td>
                  <td><Badge kind="success" dot>Active</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {(tab === "quotes" || tab === "invoices" || tab === "files") && <PlaceholderTab label={`${tabs.find(t=>t.id===tab).label} — sample data`} />}

      {/* Custom CSS for timeline */}
      <style>{`
        .timeline { position: relative; padding-left: 16px; }
        .timeline::before { content: ""; position: absolute; left: 11px; top: 12px; bottom: 0; width: 1px; background: var(--hairline); }
        .t-item { display: grid; grid-template-columns: 24px 1fr; gap: 12px; padding: 8px 0; align-items: flex-start; position: relative; }
        .t-icon { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; background: var(--paper); border: 1px solid var(--hairline); margin-left: -16px; position: relative; z-index: 1; }
        .t-body { padding-top: 2px; }
      `}</style>
    </div>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: mono ? 12 : 13, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function KVRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--hairline)", fontSize: 13 }}>
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
      <span className="tnum" style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
function ContactRow({ name, role, initials, color = "ink" }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Avatar initials={initials} color={color} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{role}</div>
      </div>
    </div>
  );
}
function PlaceholderTab({ label }) {
  return <Card><div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>{label}</div></Card>;
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.customers = CustomersScreen;
