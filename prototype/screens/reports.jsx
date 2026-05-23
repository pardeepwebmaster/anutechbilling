/* eslint-disable */
// D3 — Reports & Analytics with real SVG charts

// ============================================================
// Generic SVG charts — no external deps
// ============================================================

function LineChart({ data, labels, height = 200, color = "var(--amber)", area = true, unit = "₹" }) {
  const w = 600, h = height, pad = { l: 36, r: 12, t: 14, b: 24 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(...data) * 1.15;
  const min = 0;
  const n = data.length;

  const x = (i) => pad.l + (i / (n - 1)) * innerW;
  const y = (v) => pad.t + innerH - ((v - min) / (max - min)) * innerH;

  // Smooth Bezier curve through points (Catmull-Rom-ish)
  const path = data.map((v, i) => {
    const px = x(i), py = y(v);
    if (i === 0) return `M ${px} ${py}`;
    const prev = data[i - 1];
    const cpx1 = x(i - 1) + (px - x(i - 1)) / 2;
    const cpy1 = y(prev);
    const cpx2 = px - (px - x(i - 1)) / 2;
    const cpy2 = py;
    return `C ${cpx1} ${cpy1} ${cpx2} ${cpy2} ${px} ${py}`;
  }).join(" ");
  const areaPath = path + ` L ${x(n - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`;

  const gridY = 4;
  const gridLines = Array.from({ length: gridY + 1 }, (_, i) => pad.t + (i / gridY) * innerH);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height, display: "block" }}>
      <defs>
        <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y-axis grid lines */}
      {gridLines.map((gy, i) => (
        <g key={i}>
          <line x1={pad.l} y1={gy} x2={w - pad.r} y2={gy} stroke="var(--hairline)" strokeDasharray="2 4" />
          <text x={pad.l - 6} y={gy + 3} fontSize="9" fill="var(--ink-3)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
            {unit}{((max - (i / gridY) * (max - min)) / 1000).toFixed(0)}K
          </text>
        </g>
      ))}
      {/* Area */}
      {area && <path d={areaPath} fill="url(#line-fill)" />}
      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Data points */}
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--paper)" stroke={color} strokeWidth="1.5" />
      ))}
      {/* X-axis labels */}
      {labels.map((lab, i) => (
        <text key={i} x={x(i)} y={h - 6} fontSize="9" fill="var(--ink-3)" textAnchor="middle">{lab}</text>
      ))}
    </svg>
  );
}

function DonutChart({ slices, size = 220, hole = 0.6, centerLabel, centerValue }) {
  const r = size / 2;
  const innerR = r * hole;
  const total = slices.reduce((s, x) => s + x.value, 0);
  let acc = -Math.PI / 2;
  const arcs = slices.map(s => {
    const angle = (s.value / total) * Math.PI * 2;
    const start = acc;
    const end = acc + angle;
    acc = end;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = r + Math.cos(start) * r;
    const y1 = r + Math.sin(start) * r;
    const x2 = r + Math.cos(end) * r;
    const y2 = r + Math.sin(end) * r;
    const x3 = r + Math.cos(end) * innerR;
    const y3 = r + Math.sin(end) * innerR;
    const x4 = r + Math.cos(start) * innerR;
    const y4 = r + Math.sin(start) * innerR;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    return { ...s, d, pct: Math.round((s.value / total) * 100) };
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: `${size}px 1fr`, gap: 18, alignItems: "center" }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: "block" }}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="var(--paper)" strokeWidth="1.5" />
        ))}
        {centerValue && (
          <>
            <text x={r} y={r - 4} fontSize="26" textAnchor="middle" fontFamily="'DM Serif Display', serif" fill="var(--ink)">{centerValue}</text>
            <text x={r} y={r + 16} fontSize="10" textAnchor="middle" fill="var(--ink-3)" textTransform="uppercase" letterSpacing="0.1em">{centerLabel}</text>
          </>
        )}
      </svg>
      <div className="stack-8">
        {arcs.map((a, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto auto", gap: 8, alignItems: "center", fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color }} />
            <span>{a.label}</span>
            <span className="tnum" style={{ color: "var(--ink-3)" }}>{a.format ? a.format(a.value) : a.value}</span>
            <span className="tnum" style={{ color: "var(--ink-3)", minWidth: 30, textAlign: "right" }}>{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedBars({ data, height = 220 }) {
  const w = 600;
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...data.map(d => d.values.reduce((s, x) => s + x.value, 0))) * 1.1;
  const barW = innerW / data.length - 8;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height, display: "block" }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = pad.t + (1 - p) * innerH;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="var(--hairline)" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={y + 3} fontSize="9" fill="var(--ink-3)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
              ₹{((max * p) / 1000).toFixed(0)}K
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x = pad.l + i * (innerW / data.length) + 4;
        let yAcc = pad.t + innerH;
        return (
          <g key={i}>
            {d.values.map((v, vi) => {
              const segH = (v.value / max) * innerH;
              yAcc -= segH;
              return (
                <rect key={vi} x={x} y={yAcc} width={barW} height={segH} fill={v.color} rx={vi === d.values.length - 1 ? 3 : 0} />
              );
            })}
            <text x={x + barW / 2} y={height - 8} fontSize="10" fill="var(--ink-3)" textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// Reports screen
// ============================================================
function ReportsScreen() {
  const monthLabels = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const mrrValues  = [240000, 252000, 268000, 280000, 295000, 308000, 322000, 348000, 358000, 372000, 395000, 420000];
  const marginValues = mrrValues.map(v => Math.round(v * 0.17)); // 17% avg margin

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Engage</div>
            <h1 className="page-title">Reports</h1>
            <p className="page-sub">Live business insights · auto-refreshed every 5 minutes</p>
          </div>
          <div className="page-head-actions">
            <Btn icon="calendar">This month</Btn>
            <Btn icon="download">Export PDF</Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-6" style={{ marginBottom: 24 }}>
        <KPI label="MRR"             value="₹4.2L"  trend="+12%"     trendKind="up"   trendIcon="trending_up" />
        <KPI label="ARR"             value="₹50.4L" trend="+14%"     trendKind="up"   trendIcon="trending_up" />
        <KPI label="Margin · ARR"    value="₹8.5L"  trend="17% avg"  trendKind="up"   trendIcon="trending_up" icon="rupee" />
        <KPI label="Customer LTV"    value="₹3.2L"  trend="+₹40K"    trendKind="up"   trendIcon="trending_up" />
        <KPI label="Churn %"         value="2.1"    unit="%"         trend="−0.4pp"   trendKind="up"   trendIcon="trending_down" />
        <KPI label="Avg deal size"   value="₹2.1L"  trend="+₹15K"    trendKind="up"   trendIcon="trending_up" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24, gap: 16 }}>
        {/* MRR Trend with smooth line chart */}
        <Card title="MRR + Margin trend" sub="Last 12 months">
          <div style={{ display: "flex", gap: 18, marginBottom: 8, fontSize: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 2, background: "var(--amber)", borderRadius: 1 }} /> MRR
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 2, background: "var(--emerald)", borderRadius: 1 }} /> Your Margin
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <LineChart data={mrrValues}    labels={monthLabels} color="var(--amber)"   />
            <div style={{ marginTop: -16 }}>
              <LineChart data={marginValues} labels={monthLabels} color="var(--emerald)" />
            </div>
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)" }}>
            <span>Jun '25: ₹2.4L MRR</span>
            <span>May '26: ₹4.2L · <span style={{ color: "var(--emerald)" }}>+75% YoY</span></span>
          </div>
        </Card>

        {/* Funnel */}
        <Card title="Sales funnel" sub="This month">
          <div className="stack-12" style={{ paddingTop: 6 }}>
            {[
              { label: "Leads",          count: 120, pct: 100, color: "slate" },
              { label: "Demo scheduled", count: 68,  pct: 57,  color: "indigo" },
              { label: "Trial active",   count: 45,  pct: 37,  color: "rose" },
              { label: "Quote sent",     count: 32,  pct: 27,  color: "amber" },
              { label: "Closed won",     count: 22,  pct: 18,  color: "emerald" },
            ].map(f => (
              <div key={f.label} style={{ display: "grid", gridTemplateColumns: "120px 1fr 50px 40px", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 12 }}>{f.label}</div>
                <div className="bar"><i style={{ width: f.pct + "%", background: `var(--${f.color})` }} /></div>
                <div className="tnum serif" style={{ fontSize: 16, textAlign: "right" }}>{f.count}</div>
                <div className="tnum" style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>{f.pct}%</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24, gap: 16 }}>
        {/* Revenue by plan — donut chart */}
        <Card title="Revenue by plan" sub="ARR distribution">
          <DonutChart
            slices={[
              { label: "Workspace Plus",     value: 2100000, color: "#C2410C", format: (v) => "₹" + (v / 100000).toFixed(1) + "L" },
              { label: "Workspace Standard", value: 1400000, color: "#FBBC04", format: (v) => "₹" + (v / 100000).toFixed(1) + "L" },
              { label: "Workspace Starter",  value: 450000,  color: "#34A853", format: (v) => "₹" + (v / 100000).toFixed(0) + "K" },
              { label: "Microsoft 365",      value: 180000,  color: "#4285F4", format: (v) => "₹" + (v / 100000).toFixed(0) + "K" },
              { label: "Add-ons (Voice…)",   value: 70000,   color: "#9333EA", format: (v) => "₹" + (v / 1000).toFixed(0) + "K" },
            ]}
            centerLabel="Annual"
            centerValue="₹42L"
            size={180}
          />
        </Card>

        {/* Churn risk distribution */}
        <Card title="Renewal risk · Next 90 days" sub="Distribution across active subscriptions">
          <DonutChart
            slices={[
              { label: "Healthy (low risk)", value: 24, color: "#16A34A", format: (v) => `${v} subs` },
              { label: "Medium risk",        value: 5,  color: "#FBBC04", format: (v) => `${v} subs` },
              { label: "High risk",          value: 3,  color: "#EF4444", format: (v) => `${v} subs` },
            ]}
            centerLabel="Total"
            centerValue="32"
            size={180}
          />
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 16 }}>
        {/* Margin by vendor — stacked bars */}
        <Card title="Margin by vendor" sub="Last 6 months · stacked monthly">
          <StackedBars data={[
            { label: "Dec", values: [{ value: 48000, color: "#C2410C" }, { value: 12000, color: "#4285F4" }, { value: 3000, color: "#34A853" }] },
            { label: "Jan", values: [{ value: 52000, color: "#C2410C" }, { value: 13500, color: "#4285F4" }, { value: 3500, color: "#34A853" }] },
            { label: "Feb", values: [{ value: 54000, color: "#C2410C" }, { value: 14000, color: "#4285F4" }, { value: 3800, color: "#34A853" }] },
            { label: "Mar", values: [{ value: 58000, color: "#C2410C" }, { value: 15000, color: "#4285F4" }, { value: 4200, color: "#34A853" }] },
            { label: "Apr", values: [{ value: 62000, color: "#C2410C" }, { value: 16000, color: "#4285F4" }, { value: 4500, color: "#34A853" }] },
            { label: "May", values: [{ value: 67000, color: "#C2410C" }, { value: 17200, color: "#4285F4" }, { value: 4800, color: "#34A853" }] },
          ]} />
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, background: "#C2410C", borderRadius: 1.5 }} /> Google Workspace
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, background: "#4285F4", borderRadius: 1.5 }} /> Microsoft 365
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, background: "#34A853", borderRadius: 1.5 }} /> Zoho + add-ons
            </span>
          </div>
        </Card>

        {/* Top customers */}
        <Card title="Top customers" sub="By ARR contribution">
          <table className="tbl" style={{ marginTop: -10 }}>
            <tbody>
              {[
                ["Delta Pvt Ltd",       828000,  17],
                ["Echo Pharma",         1382400, 17],
                ["Foxtrot Logistics",   415800,  18],
                ["Acme Corp",           462000,  16],
                ["Golf Resorts",        180000,  19],
              ].map(([n, arr, pct]) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td className="right tnum serif" style={{ fontSize: 16 }}>₹{(arr / 100000).toFixed(1)}L</td>
                  <td className="right tnum" style={{ fontSize: 11, color: "var(--emerald)" }}>{pct}% margin</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.reports = ReportsScreen;
