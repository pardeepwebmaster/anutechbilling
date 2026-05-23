/* eslint-disable */
// C2 — Lead Pipeline Kanban (drag-and-drop)

function LeadCard({ lead, isDragging, onDragStart, onDragEnd, onClick }) {
  const owner = TEAM[lead.owner];
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", lead.id); onDragStart(lead.id); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="lead-card"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: 8,
        padding: 12,
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? "rotate(-1.5deg)" : "none",
        boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.08)" : "none",
        transition: "transform 120ms, box-shadow 120ms",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{lead.company}</div>
        <Avatar initials={owner.initials} color={owner.color} size="sm" />
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
        {lead.seats} seats · {lead.plan}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--hairline)" }}>
        <span className="serif tnum" style={{ fontSize: 16 }}>{rupee(lead.value, { compact: true })}</span>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{lead.age}</span>
      </div>
    </div>
  );
}

function LeadsScreen() {
  const [leads, setLeads] = useState(LEADS);
  const [dragId, setDragId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [selected, setSelected] = useState(null);
  const { toast } = useToast();
  const { go } = useRouter();

  const totalValue = leads.reduce((s, l) => s + l.value, 0);
  const wonCount = leads.filter(l => l.stage === "won").length;
  const conversion = Math.round((wonCount / leads.length) * 100);

  const handleDrop = (stageId) => {
    if (dragId) {
      setLeads(prev => prev.map(l => l.id === dragId ? { ...l, stage: stageId } : l));
      const lead = leads.find(l => l.id === dragId);
      const stage = LEAD_STAGES.find(s => s.id === stageId);
      if (lead && stage) toast(`${lead.company} → ${stage.label}`);
    }
    setDragId(null);
    setDragOverStage(null);
  };

  return (
    <div className="content wide" style={{ padding: "28px 32px 80px" }}>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <div className="page-eyebrow">Sales</div>
            <h1 className="page-title">Lead Pipeline</h1>
            <p className="page-sub">
              <span className="tnum">{leads.length}</span> active leads ·{" "}
              <span className="tnum">{rupee(totalValue, { compact: true })}</span> total pipeline ·{" "}
              <span className="tnum">{conversion}%</span> conversion
            </p>
          </div>
          <div className="page-head-actions">
            <div className="topbar-search" style={{ width: 220, padding: "5px 10px" }}>
              <I name="search" size={13} />
              <input placeholder="Search leads…" />
            </div>
            <Btn icon="filter" kind="default">Filter</Btn>
            <Btn icon="download" onClick={() => { window.__openImportLeadsOnMount = true; go("lead-gen"); }}>Import CSV</Btn>
            <Btn icon="plus" kind="primary" onClick={() => { window.__openAddLeadOnMount = true; go("lead-gen"); }}>Add Lead</Btn>
          </div>
        </div>
      </div>

      {/* Gemini AI lead-scoring suggestion */}
      <GeminiCard
        title="Lead intelligence · Today"
        actions={
          <>
            <Btn size="sm" kind="primary" icon="phone" onClick={() => toast("Calling Acme Corp — Rajesh K")}>Call Acme Corp now</Btn>
            <Btn size="sm" icon="mail" onClick={() => toast("Drafted nudge email to Zephyr")}>Nudge Zephyr</Btn>
          </>
        }
      >
        <b style={{ color: "var(--ink)" }}>3 leads worth focusing today.</b> <b>Acme Corp</b> opened your quote 3× in 24h — strong intent signal, ₹4.9L value, call within 2 hours. <b>Zephyr Networks</b> quote expires in 2 days, no response — send nudge. <b>Whitestone Pharma</b> trial Day 8 with 26/32 seats active — perfect convert moment.
      </GeminiCard>

      {/* Kanban */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${LEAD_STAGES.length}, minmax(240px, 1fr))`,
        gap: 12,
        overflowX: "auto",
        paddingBottom: 24,
      }}>
        {LEAD_STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.id);
          const stageValue = stageLeads.reduce((s, l) => s + l.value, 0);
          const isOver = dragOverStage === stage.id;
          return (
            <div
              key={stage.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={() => handleDrop(stage.id)}
              style={{
                background: isOver ? "var(--paper-2)" : "var(--paper-2)",
                border: `1.5px ${isOver ? "solid" : "dashed"} ${isOver ? "var(--amber)" : "var(--hairline)"}`,
                borderRadius: 10,
                padding: 10,
                minHeight: 400,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "border-color 120ms, background 120ms",
              }}
            >
              {/* Column header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={`dot ${stage.dot}`} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{stage.label}</span>
                  <span className="badge muted tnum" style={{ marginLeft: 2 }}>{stageLeads.length}</span>
                </div>
                <span className="tnum serif" style={{ fontSize: 13, color: "var(--ink-3)" }}>{rupee(stageValue, { compact: true })}</span>
              </div>

              {/* Cards */}
              {stageLeads.map(l => (
                <LeadCard
                  key={l.id}
                  lead={l}
                  isDragging={dragId === l.id}
                  onDragStart={setDragId}
                  onDragEnd={() => { setDragId(null); setDragOverStage(null); }}
                  onClick={() => setSelected(l)}
                />
              ))}

              {/* Add affordance */}
              <button
                onClick={() => { window.__openAddLeadOnMount = true; go("lead-gen"); }}
                style={{
                  border: "1px dashed var(--hairline)",
                  background: "transparent",
                  padding: "8px",
                  borderRadius: 6,
                  color: "var(--ink-3)",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  marginTop: stageLeads.length === 0 ? 0 : 4,
                  cursor: "pointer",
                }}>
                <I name="plus" size={12} /> Add lead
              </button>
            </div>
          );
        })}
      </div>

      {/* Help text */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)", fontSize: 12, marginTop: 4 }}>
        <I name="info" size={12} />
        Drag any card across columns to update stage. Activity log updates automatically.
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="page-eyebrow">Lead detail</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{selected.company}</div>
              </div>
              <IconBtn icon="x" onClick={() => setSelected(null)} />
            </div>
            <div className="modal-body stack-12">
              <div className="grid grid-2">
                <div><div className="field-label">Plan</div><div>{selected.plan}</div></div>
                <div><div className="field-label">Seats</div><div className="tnum">{selected.seats}</div></div>
                <div><div className="field-label">Value</div><div className="serif tnum" style={{ fontSize: 18 }}>{rupee(selected.value)}</div></div>
                <div><div className="field-label">Owner</div><div>{TEAM[selected.owner].name}</div></div>
              </div>
              <div className="hr" />
              <div className="field-label">Notes</div>
              <textarea className="textarea" defaultValue="Promising fit. Decision maker = CTO. Schedule a follow-up." />
            </div>
            <div className="modal-foot">
              <Btn kind="ghost">Archive</Btn>
              <Btn kind="default" icon="mail">Email</Btn>
              <Btn kind="default" icon="check">Save</Btn>
              <Btn kind="primary" icon="send" onClick={() => {
                window.__quoteFromLead = {
                  company: selected.company,
                  items: planToItems(selected.plan, selected.seats),
                  leadId: selected.id,
                };
                toast(`Drafting quote for ${selected.company} · ${selected.seats} seats`);
                setSelected(null);
                go("quote-builder");
              }}>Send Quote</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.leads = LeadsScreen;
