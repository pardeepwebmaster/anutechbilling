/* eslint-disable */
// Quotes list — index of all generated quotes

function QuotesListScreen() {
  const [tab, setTab] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const { go } = useRouter();
  const { toast } = useToast();

  const today = new Date("2026-05-20");
  const daysLeft = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return Math.round((d - today) / 86400000);
  };

  const counts = {
    all:      QUOTES.length,
    draft:    QUOTES.filter(q => q.status === "draft").length,
    sent:     QUOTES.filter(q => q.status === "sent").length,
    viewed:   QUOTES.filter(q => q.status === "viewed").length,
    accepted: QUOTES.filter(q => q.status === "accepted").length,
    expired:  QUOTES.filter(q => q.status === "expired" || q.status === "rejected").length,
  };

  const tabs = [
    { id: "all",      label: "All",      count: counts.all },
    { id: "draft",    label: "Draft",    count: counts.draft,    dot: "slate" },
    { id: "sent",     label: "Sent",     count: counts.sent,     dot: "amber" },
    { id: "viewed",   label: "Viewed",   count: counts.viewed,   dot: "indigo" },
    { id: "accepted", label: "Accepted", count: counts.accepted, dot: "emerald" },
    { id: "expired",  label: "Expired",  count: counts.expired,  dot: "rose" },
  ];

  const filtered = QUOTES.filter(q => {
    if (tab === "expired") { if (q.status !== "expired" && q.status !== "rejected") return false; }
    else if (tab !== "all" && q.status !== tab) return false;
    if (ownerFilter !== "all" && q.owner !== ownerFilter) return false;
    return true;
  });

  const totalValue    = QUOTES.reduce((s, q) => s + q.amount, 0);
  const acceptedValue = QUOTES.filter(q => q.status === "accepted").reduce((s, q) => s + q.amount, 0);
  const sentValue     = QUOTES.filter(q => q.status === "sent" || q.status === "viewed").reduce((s, q) => s + q.amount, 0);
  const winRate       = Math.round((counts.accepted / Math.max(1, counts.all - counts.draft)) * 100);

  // Per-quote margin via plan→item heuristic (uses subMargin since it has the same plan-name parser)
  const quoteMargin = (q) => {
    const m = subMargin({ plan: q.plan, seats: q.seats });
    return { ...m, annual: m.margin * 12 };
  };
  const pipelineMargin = QUOTES.filter(q => q.status === "sent" || q.status === "viewed")
                              .reduce((s, q) => s + quoteMargin(q).annual, 0);

  const openQuote = (q) => {
    window.__quoteFromList = q;
    go("quote-builder");
  };

  const newQuote = () => {
    delete window.__quoteFromList;
    delete window.__quoteFromLead;
    go("quote-builder");
  };

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Revenue</div>
            <h1 className="page-title">Quotes</h1>
            <p className="page-sub">All generated quotes · sorted by most recent</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="download">Export</Btn>
            <Btn icon="plus" kind="primary" onClick={newQuote}>New Quote</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-6" style={{ marginBottom: 24 }}>
        <KPI label="Total quotes"     value={counts.all}                                  trend="this quarter" />
        <KPI label="Pipeline value"   value={rupee(totalValue, { compact: true })}        trend={`${counts.sent + counts.viewed} in motion`} trendKind="up" trendIcon="trending_up" />
        <KPI label="Out for review"   value={rupee(sentValue, { compact: true })}         trend={`${counts.sent + counts.viewed} sent/viewed`} />
        <KPI label="Pipeline Margin"  value={rupee(pipelineMargin, { compact: true })}    trend="Your annual edge"  trendKind="up" trendIcon="rupee" icon="rupee" />
        <KPI label="Accepted"         value={rupee(acceptedValue, { compact: true })}     trend={`${counts.accepted} won`} trendKind="up" trendIcon="check" />
        <KPI label="Win rate"         value={winRate} unit="%"                            trend="excl. drafts" trendKind="up" trendIcon="trending_up" />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Segmented value={ownerFilter} onChange={setOwnerFilter} options={[
          { value: "all",    label: "All owners" },
          { value: "rahul",  label: "Rahul" },
          { value: "priya",  label: "Priya" },
          { value: "amit",   label: "Amit" },
        ]} />
        <div className="topbar-search" style={{ width: 240, padding: "5px 10px" }}>
          <I name="search" size={13} />
          <input placeholder="Quote ID or customer…" />
        </div>
      </div>

      <Card flush>
        <table className="tbl">
          <thead>
            <tr>
              <th>Quote ID</th>
              <th>Customer</th>
              <th>Plan</th>
              <th className="right">Seats</th>
              <th className="right">Amount</th>
              <th className="right" title="Your annual margin (price − wholesale cost)">Margin</th>
              <th>Status</th>
              <th>Created</th>
              <th>Validity</th>
              <th>Owner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(q => {
              const dl = daysLeft(q.expires);
              const expiringSoon = dl !== null && dl >= 0 && dl <= 7;
              const owner = TEAM[q.owner];
              return (
                <tr key={q.id} onClick={() => openQuote(q)} style={{ cursor: "pointer" }}>
                  <td className="mono" style={{ fontWeight: 500 }}>{q.id}</td>
                  <td>
                    <b>{q.customer}</b>
                    {q.leadId && <div className="sub mono" style={{ fontSize: 11 }}>from {q.leadId}</div>}
                  </td>
                  <td>{q.plan}</td>
                  <td className="right tnum">{q.seats}</td>
                  <td className="right tnum" style={{ fontWeight: 500 }}>{rupee(q.amount)}</td>
                  <td className="right tnum">
                    {(() => {
                      const m = quoteMargin(q);
                      const tone = m.marginPct >= 18 ? "var(--emerald)" : m.marginPct >= 14 ? "var(--amber)" : "var(--rose)";
                      return (
                        <>
                          <span style={{ color: tone, fontWeight: 500 }}>{rupee(m.annual)}</span>
                          <div className="sub" style={{ color: "var(--ink-3)", fontSize: 11 }}>{m.marginPct}%</div>
                        </>
                      );
                    })()}
                  </td>
                  <td><QuoteStatus status={q.status} /></td>
                  <td>{q.created}</td>
                  <td>
                    {q.status === "accepted"
                      ? <span style={{ color: "var(--ink-3)", fontSize: 12 }}>—</span>
                      : dl === null
                        ? "—"
                        : dl < 0
                          ? <Badge kind="danger" dot>Expired {Math.abs(dl)}d</Badge>
                          : expiringSoon
                            ? <Badge kind="warning" dot>{dl}d left</Badge>
                            : <span className="tnum" style={{ fontSize: 12, color: "var(--ink-3)" }}>{dl}d left</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar initials={owner.initials} color={owner.color} size="sm" />
                      <span style={{ fontSize: 12 }}>{owner.name.split(" ")[0]}</span>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {q.status === "draft" && <Btn size="sm" kind="primary" icon="send" onClick={() => { openQuote(q); toast(`Opening ${q.id} to send`); }}>Send</Btn>}
                    {q.status === "sent" && <Btn size="sm" icon="external" onClick={() => { window.__currentQuote = q.id; go("quote-accept"); }}>Customer view</Btn>}
                    {q.status === "viewed" && <Btn size="sm" kind="primary" icon="external" onClick={() => { window.__currentQuote = q.id; go("quote-accept"); }}>Customer view</Btn>}
                    {q.status === "accepted" && <Btn size="sm" icon="receipt" onClick={() => { go("invoices"); toast(`Invoice drafted from ${q.id}`); }}>Invoice</Btn>}
                    {(q.status === "expired" || q.status === "rejected") && <Btn size="sm" icon="copy" onClick={() => { openQuote(q); toast(`Duplicated ${q.id}`); }}>Re-quote</Btn>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)", fontSize: 12, marginTop: 12 }}>
        <I name="info" size={12} />
        Click any row to open the quote in the builder. Draft quotes can still be edited; sent/viewed quotes open in read-only preview.
      </div>
    </div>
  );
}

function QuoteStatus({ status }) {
  const map = {
    draft:    { kind: "muted",   label: "Draft" },
    sent:     { kind: "warning", label: "Sent" },
    viewed:   { kind: "info",    label: "Viewed" },
    accepted: { kind: "success", label: "Accepted" },
    expired:  { kind: "danger",  label: "Expired" },
    rejected: { kind: "danger",  label: "Rejected" },
  };
  const m = map[status] || map.draft;
  return <Badge kind={m.kind} dot>{m.label}</Badge>;
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.quotes = QuotesListScreen;
