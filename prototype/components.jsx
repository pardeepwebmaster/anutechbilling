/* eslint-disable */
// Shared components and primitives for ResellerOS
// Exports to window for cross-file React access.

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// ============================================================
// Icons (lucide-style 1.5px stroke)
// ============================================================
function I({ name, size = 16, className = "ico" }) {
  const paths = ICONS[name] || ICONS.dot;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const ICONS = {
  dot: ["M12 12h.01"],
  home: ["M3 11.5 12 4l9 7.5", "M5 10v10h14V10"],
  target: ["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0", "M12 12h.01"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13h6", "M9 17h6"],
  receipt: ["M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2", "M16 8H8", "M16 12H8", "M13 16H8"],
  refresh: ["M21 12a9 9 0 1 1-3-6.7", "M21 3v6h-6"],
  clock: ["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M12 7v5l3 2"],
  package: ["m7.5 4.27 9 5.15", "M21 8 12 13 3 8", "M3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8", "M12 22V13"],
  zap: ["M13 2 3 14h9l-1 8 10-12h-9z"],
  bell: ["M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  search: ["M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0", "m21 21-4.3-4.3"],
  plus: ["M12 5v14", "M5 12h14"],
  arrow_right: ["M5 12h14", "m12 5 7 7-7 7"],
  arrow_left: ["m19 12-14 0", "m12 19-7-7 7-7"],
  arrow_up_right: ["M7 17 17 7", "M7 7h10v10"],
  trending_up: ["m23 6-9.5 9.5-5-5L1 18", "M17 6h6v6"],
  trending_down: ["m23 18-9.5-9.5-5 5L1 6", "M17 18h6v-6"],
  check: ["m20 6-11 11-5-5"],
  check_circle: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "m9 11 3 3L22 4"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  x_circle: ["M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "m15 9-6 6", "m9 9 6 6"],
  alert: ["M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"],
  info: ["M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "M12 16v-4", "M12 8h.01"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2", "m22 6-10 7L2 6"],
  phone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"],
  message: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  whatsapp: ["M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"],
  settings: ["M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z", "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  chart: ["M3 3v18h18", "M7 14l4-4 4 4 6-6"],
  pie: ["M21.21 15.89A10 10 0 1 1 8 2.83", "M22 12A10 10 0 0 0 12 2v10z"],
  layout: ["M3 3h18v18H3z", "M3 9h18", "M9 21V9"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  globe: ["M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"],
  filter: ["M22 3H2l8 9.46V19l4 2v-8.54z"],
  more_h: ["M12 12h.01", "M19 12h.01", "M5 12h.01"],
  more_v: ["M12 12h.01", "M12 5h.01", "M12 19h.01"],
  edit: ["M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"],
  trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  copy: ["M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  link: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  external: ["M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", "M15 3h6v6", "M10 14 21 3"],
  calendar: ["M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"],
  star: ["M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87L8.91 8.26z"],
  bolt: ["m13 2-2 13 7-3-1 10 5-13-7 3z"],
  grip: ["M9 5h.01", "M9 12h.01", "M9 19h.01", "M15 5h.01", "M15 12h.01", "M15 19h.01"],
  chevron_down: ["m6 9 6 6 6-6"],
  chevron_right: ["m9 6 6 6-6 6"],
  chevron_left: ["m15 6-6 6 6 6"],
  chevron_up: ["m6 15 6-6 6 6"],
  play: ["m5 3 14 9-14 9z"],
  lock: ["M3 11h18v11H3z", "M7 11V7a5 5 0 0 1 10 0v4"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  rupee: ["M6 3h12", "M6 8h12", "M6 13l9 8", "M6 13h3a4 4 0 0 0 0-8H7"],
  spark: ["M12 3v3", "M12 18v3", "M3 12h3", "M18 12h3", "m5.6 5.6 2.1 2.1", "m16.3 16.3 2.1 2.1", "m5.6 18.4 2.1-2.1", "m16.3 7.7 2.1-2.1"],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
  tag: ["M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z", "M7 7h.01"],
  building: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 9h1", "M9 13h1", "M9 17h1", "M14 9h1", "M14 13h1", "M14 17h1"],
  briefcase: ["M21 7H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z", "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"],
  sliders: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  send: ["m22 2-7 20-4-9-9-4z", "m22 2-11 11"],
  smile: ["M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"],
  sparkles: ["m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5z", "M5 18l-.5 1.5L3 20l1.5.5L5 22l.5-1.5L7 20l-1.5-.5z", "M19 4l-.5 1.5L17 6l1.5.5L19 8l.5-1.5L21 6l-1.5-.5z"],
  flame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  workflow: ["M3 3h6v6H3z", "M15 15h6v6h-6z", "M9 6h6a3 3 0 0 1 3 3v6"],
  mobile: ["M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M12 18h.01"],
  sun: ["M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0", "M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42", "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42"],
  moon: ["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"],
  cart: ["M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"],
  award: ["M12 15m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0", "m8.21 13.89-1.21 7.11 5-3 5 3-1.21-7.12"],
  database: ["M12 5c5 0 9 1.5 9 3v8c0 1.5-4 3-9 3s-9-1.5-9-3V8c0-1.5 4-3 9-3z", "M3 8c0 1.5 4 3 9 3s9-1.5 9-3", "M3 12c0 1.5 4 3 9 3s9-1.5 9-3"],
  layers: ["m12 2 10 6-10 6L2 8z", "m2 12 10 6 10-6", "m2 16 10 6 10-6"],
  paint: ["M19 11h2m-2 0V9m0 2v2", "M12 19v-7", "M5 5h14v6a7 7 0 0 1-7 7", "M5 5v6a7 7 0 0 0 7 7"],
  rocket: ["M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z", "M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z", "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0", "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"],
  question: ["M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
  ticket: ["M3 7v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z", "M13 5v2", "M13 17v2", "M13 11v2"],
  book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"],
};

// ============================================================
// Theme context
// ============================================================
const ThemeCtx = createContext({ theme: "light", setTheme: () => {} });

function ThemeProvider({ children }) {
  const initial = (typeof document !== "undefined" && document.documentElement.dataset.theme) || "light";
  const [theme, setTheme] = useState(initial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}
const useTheme = () => useContext(ThemeCtx);

// ============================================================
// Router (hash-based)
// ============================================================
const RouterCtx = createContext({ route: "dashboard", go: () => {} });
function useRouter() { return useContext(RouterCtx); }

function parseHash() {
  const h = window.location.hash || "#/dashboard";
  return h.replace(/^#\//, "").split("?")[0] || "dashboard";
}

function RouterProvider({ children }) {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const fn = () => setRoute(parseHash());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const go = useCallback((r) => { window.location.hash = "#/" + r; }, []);
  return <RouterCtx.Provider value={{ route, go }}>{children}</RouterCtx.Provider>;
}

// ============================================================
// Primitives
// ============================================================
function Btn({ kind = "default", size, children, icon, iconRight, onClick, type = "button", className = "", ...rest }) {
  const cls = ["btn", kind !== "default" && kind, size, className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} onClick={onClick} {...rest}>
      {icon && <I name={icon} />}
      {children}
      {iconRight && <I name={iconRight} />}
    </button>
  );
}

function IconBtn({ icon, onClick, title }) {
  return <button className="icon-btn" onClick={onClick} title={title}><I name={icon} /></button>;
}

function Badge({ kind = "muted", children, dot = false }) {
  return (
    <span className={`badge ${kind}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

function Avatar({ initials, color = "ink", size = "" }) {
  return <div className={`avatar ${size} ${color}`}>{initials}</div>;
}

function KPI({ label, value, unit, trend, trendKind = "neutral", trendIcon, icon }) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        {icon && <I name={icon} />}
        {label}
      </div>
      <div className="kpi-value">{value}{unit && <span className="unit">{unit}</span>}</div>
      {trend && (
        <div className={`kpi-trend ${trendKind}`}>
          {trendIcon && <I name={trendIcon} size={11} />}
          {trend}
        </div>
      )}
    </div>
  );
}

function Card({ title, sub, actions, children, className = "", tight = false, flush = false }) {
  return (
    <div className={`card ${tight ? "tight" : ""} ${flush ? "flush" : ""} ${className}`}>
      {(title || actions) && (
        <div className="card-head" style={flush ? { padding: "14px 18px 0" } : null}>
          <div>
            {title && <div className="card-title">{title}</div>}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {actions && <div className="row" style={{ gap: 6 }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function Vendor({ name }) {
  const map = {
    google: { cls: "google", letter: "G" },
    microsoft: { cls: "microsoft", letter: "M" },
    zoho: { cls: "zoho", letter: "Z" },
  };
  const v = map[name];
  if (!v) return null;
  const labels = { google: "Google", microsoft: "Microsoft", zoho: "Zoho" };
  return (
    <span className={`vendor ${v.cls}`}>
      <span className="v-dot">{v.letter}</span>
      {labels[name]}
    </span>
  );
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.id} className={`tab ${value === t.id ? "active" : ""}`} onClick={() => onChange(t.id)}>
          {t.dot && <span className={`dot ${t.dot}`} />}
          {t.label}
          {t.count !== undefined && <span className="count tnum">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      {children}
    </div>
  );
}

// ============================================================
// Loading skeletons — pulsing gray placeholders
// ============================================================
function Skeleton({ w = "100%", h = 14, rounded = 4, style }) {
  return (
    <span
      className="skeleton"
      style={{
        display: "inline-block",
        width: w,
        height: h,
        borderRadius: rounded,
        background: "linear-gradient(90deg, var(--paper-2) 0%, var(--hairline) 50%, var(--paper-2) 100%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="skeleton-row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><Skeleton w={i === 0 ? "60%" : i === cols - 1 ? "30%" : "80%"} h={12} /></td>
      ))}
    </tr>
  );
}

function SkeletonKPI() {
  return (
    <div className="kpi">
      <div className="kpi-label"><Skeleton w={80} h={11} /></div>
      <div style={{ marginTop: 8 }}><Skeleton w={120} h={24} /></div>
      <div style={{ marginTop: 8 }}><Skeleton w={60} h={10} /></div>
    </div>
  );
}

// ============================================================
// Activity Timeline — vertical event log for an entity
// ============================================================
function ActivityTimeline({ events = [], compact = false }) {
  return (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      {/* Vertical line */}
      <div style={{
        position: "absolute",
        left: 11,
        top: 8,
        bottom: 8,
        width: 1.5,
        background: "var(--hairline)",
      }} />
      {events.map((ev, i) => {
        const tone = ev.kind || "indigo";
        return (
          <div key={i} style={{ position: "relative", paddingBottom: compact ? 12 : 18 }}>
            {/* Dot */}
            <div style={{
              position: "absolute",
              left: -24,
              top: 2,
              width: 23,
              height: 23,
              borderRadius: "50%",
              background: `var(--${tone}-soft)`,
              color: `var(--${tone})`,
              display: "grid",
              placeItems: "center",
              border: "2px solid var(--paper)",
            }}>
              <I name={ev.icon || "dot"} size={12} />
            </div>
            {/* Content */}
            <div>
              <div style={{ fontSize: compact ? 12 : 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.4 }}>
                {ev.title}
              </div>
              {ev.body && (
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.5 }}>
                  {ev.body}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>{ev.time}</span>
                {ev.actor && <><span>·</span><span>by {ev.actor}</span></>}
                {ev.meta && <><span>·</span><span>{ev.meta}</span></>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Gemini AI suggestion card — gradient-bordered AI insight box
// Use for: lead scoring, quote optimization, renewal next-best-action, etc.
// ============================================================
function GeminiCard({ title = "Gemini AI suggests", children, actions, compact = false }) {
  return (
    <div style={{
      position: "relative",
      borderRadius: 10,
      padding: 1.5,
      background: "linear-gradient(135deg, #4285F4 0%, #9333EA 50%, #EC4899 100%)",
      marginBottom: compact ? 8 : 16,
    }}>
      <div style={{
        background: "linear-gradient(135deg, var(--paper) 0%, var(--paper-2) 100%)",
        borderRadius: 8.5,
        padding: compact ? "10px 12px" : "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: compact ? 4 : 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24">
            <defs>
              <linearGradient id={"geminispark-" + Math.random()} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4285F4"/>
                <stop offset="50%" stopColor="#9333EA"/>
                <stop offset="100%" stopColor="#EC4899"/>
              </linearGradient>
            </defs>
            <path fill="url(#geminispark-0)" d="M12 2 L14 9 L21 11 L14 13 L12 20 L10 13 L3 11 L10 9 Z"/>
          </svg>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            background: "linear-gradient(90deg, #4285F4, #9333EA, #EC4899)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>{title}</span>
        </div>
        <div style={{ fontSize: compact ? 12 : 13, color: "var(--ink)", lineHeight: 1.55 }}>
          {children}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Empty state — illustrated nudge for empty lists
// ============================================================
function EmptyState({ icon = "inbox", title, body, action, secondary, sample }) {
  return (
    <div style={{
      padding: "48px 24px",
      textAlign: "center",
      maxWidth: 460,
      margin: "0 auto",
    }}>
      {/* Illustrated icon — circle with soft gradient and the icon */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--amber-soft) 0%, var(--paper-2) 100%)",
        display: "grid",
        placeItems: "center",
        margin: "0 auto 18px",
        color: "var(--amber)",
        boxShadow: "0 8px 24px rgba(194,65,12,0.08), inset 0 0 0 1px var(--hairline)",
      }}>
        <I name={icon} size={32} />
      </div>
      <h3 style={{
        fontFamily: "var(--serif)",
        fontSize: 22,
        lineHeight: 1.2,
        margin: "0 0 8px",
        color: "var(--ink)",
      }}>{title}</h3>
      {body && (
        <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55, margin: "0 0 22px" }}>
          {body}
        </p>
      )}
      <div className="row" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
        {action}
        {secondary}
      </div>
      {sample && (
        <div style={{ marginTop: 18, fontSize: 11, color: "var(--ink-3)" }}>
          Or{" "}
          <button
            onClick={sample.onClick}
            style={{ background: "transparent", border: "none", color: "var(--indigo)", textDecoration: "underline", cursor: "pointer", fontSize: 11, padding: 0 }}
          >
            load sample data
          </button>
          {" "}to explore
        </div>
      )}
    </div>
  );
}

// ============================================================
// Number formatting — INR with Indian lakh separators
// ============================================================
function rupee(n, opts = {}) {
  const { compact = false, decimals = 0 } = opts;
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 10000000) return "₹" + (n / 10000000).toFixed(decimals || 1) + "Cr";
    if (abs >= 100000) return "₹" + (n / 100000).toFixed(decimals || 1) + "L";
    if (abs >= 1000) return "₹" + (n / 1000).toFixed(decimals || 1) + "K";
    return "₹" + n.toFixed(decimals);
  }
  // Indian numbering format with commas (e.g., 4,90,644)
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  let last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return "₹" + formatted + (dec ? "." + dec : "");
}

function num(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-IN");
}

// ============================================================
// Toast
// ============================================================
const ToastCtx = createContext({ toast: () => {} });
function useToast() { return useContext(ToastCtx); }

function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const toast = useCallback((m) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2400);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {msg && (
        <div className="toast"><I name="check_circle" />{msg}</div>
      )}
    </ToastCtx.Provider>
  );
}

// ============================================================
// Export to window
// ============================================================
Object.assign(window, {
  I, ICONS,
  ThemeProvider, useTheme,
  RouterProvider, useRouter,
  Btn, IconBtn, Badge, Avatar, KPI, Card, Vendor, Tabs, Segmented, Field,
  rupee, num,
  ToastProvider, useToast,
});
