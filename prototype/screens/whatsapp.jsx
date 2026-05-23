/* eslint-disable */
// WhatsApp Inbox — incoming messages → convert to lead flow

const WA_THREADS = [
  {
    id: "wa1",
    name: "Vishal Mehra",
    phone: "+91 91234 56789",
    company: "Greenfield Manufacturing",
    lastTime: "2m ago",
    unread: 3,
    leadId: null,
    intent: "pricing_inquiry",
    messages: [
      { dir: "in",  text: "Hi, aapka Workspace Plus ka price kya hai?",        time: "10:42 AM" },
      { dir: "in",  text: "30 users hain mere paas",                            time: "10:42 AM" },
      { dir: "in",  text: "Maharashtra mein hain hum, GST registered.",         time: "10:43 AM" },
    ],
  },
  {
    id: "wa2",
    name: "Amit Sharma",
    phone: "+91 98765 11122",
    company: null,
    lastTime: "18m ago",
    unread: 1,
    leadId: null,
    intent: "demo_request",
    messages: [
      { dir: "in",  text: "Hello, can I get a demo of Google Workspace? Looking for 12-15 seats for our startup.", time: "10:25 AM" },
    ],
  },
  {
    id: "wa3",
    name: "Priya Mehta",
    phone: "+91 90876 54321",
    company: "Skybridge Logistics",
    lastTime: "1h ago",
    unread: 0,
    leadId: null,
    intent: "referral",
    messages: [
      { dir: "in",  text: "Hi, Rajesh from Acme Corp suggested I contact you. We need M365 for ~40 employees.", time: "09:48 AM" },
      { dir: "out", text: "Hi Priya! Thanks for reaching out. Rajesh has been a wonderful customer. Let me send you a quick brief on M365 plans + a Calendly link for a 20-min discovery call.", time: "09:51 AM" },
      { dir: "in",  text: "Sounds great, please share.",                                                          time: "09:53 AM" },
    ],
  },
  {
    id: "wa4",
    name: "Ravi Patel",
    phone: "+91 99887 76655",
    company: "Patel Pharma Distribution",
    lastTime: "3h ago",
    unread: 2,
    leadId: null,
    intent: "urgent",
    messages: [
      { dir: "in",  text: "Need Microsoft 365 for 50 users urgently. Our current provider's contract ends next week.", time: "07:50 AM" },
      { dir: "in",  text: "Can we get a quote today?",                                                                   time: "07:51 AM" },
    ],
  },
  {
    id: "wa5",
    name: "Vikram S",
    phone: "+91 98123 45678",
    company: "TechBrand Pvt Ltd",
    lastTime: "5h ago",
    unread: 0,
    leadId: "L1",
    intent: "active_lead",
    messages: [
      { dir: "in",  text: "Aapne quote bheja tha last week, kya 5% extra discount mil sakta hai?", time: "Yesterday" },
      { dir: "out", text: "Vikram ji, special case mein 3% extra de sakta hoon, total 13%. Bolo?", time: "Yesterday" },
      { dir: "in",  text: "OK, manzoor. Invoice bhej do.",                                          time: "05:30 AM" },
    ],
  },
  {
    id: "wa6",
    name: "Unknown",
    phone: "+91 87654 32100",
    company: null,
    lastTime: "1d ago",
    unread: 0,
    leadId: null,
    intent: "low",
    messages: [
      { dir: "in",  text: "Hello",   time: "Yesterday" },
      { dir: "out", text: "Hi! How can I help you today? Are you looking for cloud services for your business?", time: "Yesterday" },
    ],
  },
  {
    id: "wa7",
    name: "Sneha K (existing)",
    phone: "+91 99000 11223",
    company: "Beta Industries",
    lastTime: "2d ago",
    unread: 0,
    leadId: "customer",
    intent: "support",
    messages: [
      { dir: "in",  text: "Hi, ek user ka password reset karna hai. Help kar do please.", time: "12 May" },
      { dir: "out", text: "Sure Sneha, ticket #TKT-0231 banayi hai. 30 min mein resolve kar denge.", time: "12 May" },
    ],
  },
];

const INTENT_META = {
  pricing_inquiry: { label: "Pricing inquiry", kind: "warning" },
  demo_request:    { label: "Demo request",   kind: "info" },
  referral:        { label: "Referral",       kind: "success" },
  urgent:          { label: "Urgent",         kind: "danger" },
  active_lead:     { label: "Active lead",    kind: "muted" },
  support:         { label: "Support",        kind: "muted" },
  low:             { label: "Low intent",     kind: "muted" },
};

function WhatsAppInboxScreen() {
  const [activeId, setActiveId] = useState("wa1");
  const [filter, setFilter] = useState("unconverted"); // all | unread | unconverted
  const [reply, setReply] = useState("");
  const { go } = useRouter();
  const { toast } = useToast();

  const filtered = WA_THREADS.filter(t => {
    if (filter === "unread") return t.unread > 0;
    if (filter === "unconverted") return !t.leadId;
    return true;
  });

  const active = WA_THREADS.find(t => t.id === activeId) || WA_THREADS[0];

  const unreadCount = WA_THREADS.reduce((s, t) => s + t.unread, 0);
  const unconvertedCount = WA_THREADS.filter(t => !t.leadId).length;

  const convertToLead = () => {
    const intentToPlan = {
      pricing_inquiry: "Workspace Plus",
      demo_request:    "Workspace Std",
      referral:        "Microsoft 365",
      urgent:          "Microsoft 365",
    };
    const intentToNotes = {
      pricing_inquiry: "WhatsApp pricing inquiry. Last message: \"" + active.messages[active.messages.length - 1].text + "\"",
      demo_request:    "Demo request via WhatsApp. " + active.messages[0].text,
      referral:        "Referred via WhatsApp. " + active.messages[0].text,
      urgent:          "URGENT — current provider contract ending soon. " + active.messages[0].text,
    };
    const seatGuess = /\b(\d+)\s*(users|seats|employees)/i.exec(active.messages.map(m => m.text).join(" "));
    window.__addLeadSeed = {
      company: active.company || "",
      contact: active.name,
      email: "",
      phone: active.phone,
      seats: seatGuess ? +seatGuess[1] : 25,
      plan: intentToPlan[active.intent] || "Workspace Std",
      source: "whatsapp",
      stage: active.intent === "demo_request" ? "demo" : "new",
      notes: intentToNotes[active.intent] || active.messages[0].text,
    };
    toast(`Converting ${active.name} to lead…`);
    go("lead-gen");
  };

  return (
    <div className="content wide" style={{ padding: "28px 32px 32px", display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <I name="whatsapp" size={12} style={{ color: "#25D366" }} /> Engage · Connected to Interakt
            </div>
            <h1 className="page-title">WhatsApp Inbox</h1>
            <p className="page-sub">
              <b className="tnum">{unreadCount}</b> unread · <b className="tnum">{unconvertedCount}</b> not yet leads · Auto-sync every 30s
            </p>
          </div>
          <div className="page-head-actions">
            <Btn icon="settings">Templates</Btn>
            <Btn icon="zap" kind="primary">Set up auto-reply</Btn>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        gap: 0,
        border: "1px solid var(--hairline)",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--paper)",
      }}>
        {/* Conversations list */}
        <div style={{ borderRight: "1px solid var(--hairline)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: 10, borderBottom: "1px solid var(--hairline)" }}>
            <Segmented value={filter} onChange={setFilter} options={[
              { value: "unconverted", label: "New leads" },
              { value: "unread",      label: "Unread" },
              { value: "all",         label: "All" },
            ]} />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.map(t => {
              const intent = INTENT_META[t.intent] || INTENT_META.low;
              const isActive = t.id === activeId;
              const last = t.messages[t.messages.length - 1];
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--hairline)",
                    cursor: "pointer",
                    background: isActive ? "var(--paper-2)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--amber)" : "3px solid transparent",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: t.unread > 0 ? 600 : 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", flexShrink: 0 }}>{t.lastTime}</div>
                  </div>
                  {t.company && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{t.company}</div>}
                  <div style={{ fontSize: 11, color: t.unread > 0 ? "var(--ink)" : "var(--ink-3)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {last.dir === "out" ? "You: " : ""}{last.text}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 6 }}>
                    {t.leadId === "customer"
                      ? <Badge kind="info"    dot>Customer</Badge>
                      : t.leadId
                        ? <Badge kind="success" dot>Lead {t.leadId}</Badge>
                        : <Badge kind={intent.kind} dot>{intent.label}</Badge>}
                    {t.unread > 0 && (
                      <span style={{ background: "var(--amber)", color: "#fff", borderRadius: 12, fontSize: 10, padding: "1px 7px", fontWeight: 600 }}>
                        {t.unread}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <EmptyState
                icon="whatsapp"
                title="No conversations match"
                body="Try a different filter or search term."
              />
            )}
          </div>
        </div>

        {/* Message thread */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
          {/* Thread header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", background: "var(--paper)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar initials={active.name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase()} color="emerald" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{active.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="mono">{active.phone}</span>
                  {active.company && <><span>·</span><span>{active.company}</span></>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {active.leadId === "customer" ? (
                <>
                  <Badge kind="info" dot>Existing customer</Badge>
                  <Btn size="sm" icon="ticket" onClick={() => { go("support"); toast(`Ticket opened for ${active.company}`); }}>Open ticket</Btn>
                </>
              ) : active.leadId ? (
                <>
                  <Badge kind="success" dot>Lead {active.leadId}</Badge>
                  <Btn size="sm" icon="arrow_right" onClick={() => go("leads")}>View in pipeline</Btn>
                </>
              ) : (
                <>
                  <Badge kind={INTENT_META[active.intent]?.kind || "muted"} dot>{INTENT_META[active.intent]?.label || "Unclassified"}</Badge>
                  <Btn size="sm" kind="primary" icon="user" onClick={convertToLead}>Convert to lead</Btn>
                </>
              )}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            {active.messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.dir === "out" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "70%",
                  padding: "8px 12px",
                  borderRadius: m.dir === "out" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                  background: m.dir === "out" ? "#DCF8C6" : "#fff",
                  color: "#1A1815",
                  fontSize: 13,
                  lineHeight: 1.45,
                  border: "1px solid var(--hairline)",
                  boxShadow: "0 1px 1px rgba(0,0,0,0.04)",
                }}>
                  <div>{m.text}</div>
                  <div style={{ fontSize: 10, color: "#6B6457", marginTop: 4, textAlign: "right", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    {m.time}
                    {m.dir === "out" && <I name="check" size={10} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div style={{ borderTop: "1px solid var(--hairline)", padding: 12, background: "var(--paper)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                className="textarea"
                rows={2}
                placeholder="Reply via WhatsApp…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                style={{ flex: 1, fontSize: 13, resize: "none" }}
              />
              <Btn icon="copy" size="sm">Templates</Btn>
              <Btn kind="primary" icon="send" disabled={!reply.trim()} onClick={() => {
                toast(`Replied to ${active.name}`);
                setReply("");
              }}>Send</Btn>
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <I name="info" size={10} />
              24-hour customer service window · For new conversations after 24h, use approved templates only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.whatsapp = WhatsAppInboxScreen;
