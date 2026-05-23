/* eslint-disable */
// D5 — Mobile PWA preview

function MobileScreen() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">System</div>
            <h1 className="page-title">Mobile (PWA)</h1>
            <p className="page-sub">A field-ready version of ResellerOS — install from browser, no app store needed</p>
          </div>
          <Btn kind="primary" icon="download">Install as app</Btn>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "auto 1fr", gap: 40, alignItems: "flex-start" }}>
        {/* Phone frame */}
        <div className="phone">
          <div className="phone-notch"></div>
          <div className="phone-screen">
            <div className="phone-status">
              <span>9:41</span>
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <I name="globe" size={11} />
                <I name="bell" size={11} />
              </span>
            </div>
            <div className="phone-header">
              <I name="list" size={16} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>ResellerOS</span>
              <I name="bell" size={16} />
            </div>
            <div className="phone-body">
              <div className="phone-eyebrow">My day</div>
              <div className="phone-quick-stats">
                <div><div className="qs-num">3</div><div className="qs-lbl">Tasks</div></div>
                <div><div className="qs-num">2</div><div className="qs-lbl">Calls</div></div>
                <div><div className="qs-num">₹4.2L</div><div className="qs-lbl">Pipeline</div></div>
              </div>

              <div className="phone-section-label">Today's followups</div>

              <div className="phone-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Acme Corp</div>
                  <Avatar initials="RK" size="sm" color="indigo" />
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>Call Rajesh · 11:30 AM</div>
                <div className="row" style={{ gap: 6, marginTop: 10 }}>
                  <button className="btn primary sm" style={{ flex: 1, justifyContent: "center" }}><I name="phone" size={12} />Call</button>
                  <button className="btn sm" style={{ flex: 1, justifyContent: "center" }}><I name="edit" size={12} />Note</button>
                </div>
              </div>

              <div className="phone-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Beta Industries</div>
                  <Avatar initials="PR" size="sm" color="amber" />
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>Quote follow-up · 2:00 PM</div>
                <div className="row" style={{ gap: 6, marginTop: 10 }}>
                  <button className="btn sm" style={{ flex: 1, justifyContent: "center" }}><I name="mail" size={12} />Email</button>
                  <button className="btn sm" style={{ flex: 1, justifyContent: "center", color: "#25D366", borderColor: "#25D366" }}><I name="whatsapp" size={12} />WhatsApp</button>
                </div>
              </div>

              <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
                <I name="plus" /> Quick add
              </button>
            </div>
            <div className="phone-tabbar">
              {[
                ["home",      "home"],
                ["target",    "leads"],
                ["users",     "customers"],
                ["message",   "chat"],
                ["settings",  "settings"],
              ].map(([icon, id]) => (
                <button key={id} className={activeTab === id ? "phone-tab active" : "phone-tab"} onClick={() => setActiveTab(id)}>
                  <I name={icon} size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Capabilities list */}
        <Card title="Mobile capabilities" sub="Everything sales reps need in the field">
          <div className="grid grid-2">
            {[
              ["One-tap call", "phone"],
              ["Email with templates", "mail"],
              ["WhatsApp Business", "whatsapp"],
              ["Drag-drop kanban", "target"],
              ["GPS check-in", "globe"],
              ["Voice notes → activity", "spark"],
              ["Photo capture", "package"],
              ["Offline mode", "database"],
            ].map(([label, icon]) => (
              <div key={label} className="row" style={{ gap: 10, padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--emerald-soft)", color: "var(--emerald)", display: "grid", placeItems: "center" }}>
                  <I name={icon} />
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>{label}</div>
                <I name="check" size={14} style={{ color: "var(--emerald)" }} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 16, background: "var(--amber-soft)", borderRadius: 10 }}>
            <div style={{ fontWeight: 600, color: "var(--amber-ink)" }}>Install as app</div>
            <div style={{ fontSize: 12, color: "var(--amber-ink)", opacity: 0.8, marginTop: 4 }}>PWA installs from browser — no app store needed. Works on iOS and Android.</div>
            <Btn kind="accent" style={{ marginTop: 12 }} icon="download">Add to home screen</Btn>
          </div>
        </Card>
      </div>

      <style>{`
        .phone {
          width: 300px;
          height: 620px;
          background: #0a0a0a;
          border-radius: 38px;
          padding: 10px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          position: relative;
        }
        .phone-notch {
          position: absolute;
          top: 18px; left: 50%;
          transform: translateX(-50%);
          width: 90px; height: 18px;
          background: #0a0a0a;
          border-radius: 0 0 14px 14px;
          z-index: 2;
        }
        .phone-screen {
          background: var(--paper);
          border-radius: 28px;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .phone-status {
          padding: 10px 22px 4px;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
        }
        .phone-header {
          padding: 18px 16px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--hairline);
        }
        .phone-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
        }
        .phone-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink-3); font-weight: 600; margin-bottom: 8px; }
        .phone-quick-stats {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 10px;
          padding: 10px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
        }
        .qs-num { font-family: var(--font-display); font-size: 18px; }
        .qs-lbl { font-size: 10px; color: var(--ink-3); }
        .phone-section-label { font-size: 11px; color: var(--ink-3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin: 8px 0 8px; }
        .phone-card { background: var(--paper); border: 1px solid var(--hairline); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
        .phone-tabbar {
          height: 56px;
          border-top: 1px solid var(--hairline);
          display: grid;
          grid-template-columns: repeat(5, 1fr);
        }
        .phone-tab { display: grid; place-items: center; color: var(--ink-3); }
        .phone-tab.active { color: var(--amber); }
      `}</style>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.mobile = MobileScreen;
