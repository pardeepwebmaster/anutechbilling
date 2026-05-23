/* eslint-disable */
// E5 — FAQ

function FaqScreen() {
  const [open, setOpen] = useState(0);

  const faqs = [
    { q: "Kya mera existing data migrate hoga?",
      a: "Haan, bilkul. Aapke existing customers, subscriptions, invoices — sab kuch ResellerOS me migrate ho jayega. Migration script Phase 1 me hi run karenge. Aapko ek baar verify karna padega, fir purana system band kar sakte ho." },
    { q: "Project ke baad maintenance ka kya?",
      a: "Plan ke hisaab se 3 / 6 / 12 months ka support included hai (bug fixes + minor changes). Uske baad aap monthly retainer le sakte ho (~₹15K/mo) ya per-incident basis pe charge lagega." },
    { q: "Source code mera hoga?",
      a: "100%. Full ownership. GitHub repo aapko hand over kar denge — aap apni dev team ko ya kisi bhi vendor ko de sakte ho future me." },
    { q: "Tech stack kya hai? Future me extend ho payega?",
      a: "React + Firebase (Firestore + Functions + Hosting). Indian dev community me bahut common — koi bhi MERN/full-stack developer maintain kar sakta hai. Modular architecture, har module independently update ho sakta hai." },
    { q: "Team ko training kaise milegi?",
      a: "2 live training sessions (each 90 mins) included — Sales ke liye ek, Owner/Accountant ke liye ek. Plus video tutorials + SOPs PDF mil jayegi. Onboarding ke time hum on-site visit bhi kar sakte hain (extra)." },
    { q: "Agar beech me scope change karna ho?",
      a: "First minor change (within 10% of scope) free. Beyond that, change-request process — written estimate dete hain, aap approve karte ho, fir implement. Transparent." },
    { q: "Multi-vendor (Google + Microsoft + Zoho) ek sath chalega?",
      a: "Enterprise plan me. Complete plan me primary vendor + 1 secondary. Starter plan me ek vendor only. Aap baad me upgrade kar sakte ho — koi data loss nahi." },
    { q: "WhatsApp Business kaise setup hoga?",
      a: "WhatsApp Business API account chahiye (Meta verification process — hum guide karenge). Setup 2–3 weeks lagta hai Meta side se. Hum free of cost guide karenge. Templates pre-built milengi." },
    { q: "Razorpay integration kaise kaam karega?",
      a: "Aap apna Razorpay account use karenge — paise direct aapke account me aate hain. Webhook auto-marks invoice paid, receipt auto-send hota hai. Razorpay 2% charge karega — that's their fee, not ours." },
    { q: "Customer ka data secure hai?",
      a: "Firebase me data encrypted at rest + in transit. Role-based access control (RBAC) — sirf authorized users hi sensitive data dekh sakte hain. Audit log har action ka. India region servers use kar sakte hain." },
    { q: "GST compliance ka kya?",
      a: "HSN codes pre-configured. GSTR-1 export ready format me. CGST/SGST/IGST auto-calculate hota hai customer ke state ke basis pe. Zoho Books me direct push hota hai monthly filing ke liye." },
    { q: "Free trial ya pilot possible hai?",
      a: "Yes — 14-day free demo environment dete hain with sample data. Aap apni team ko explore karne de sakte ho. Production setup ke liye 25% advance lagta hai (kick-off payment)." },
    { q: "Implementation start kab ho sakta hai?",
      a: "Project sign + kick-off payment milne ke 5 working days me start ho jayega. Phase 1 (Foundation) ke liye aapki team ka 4-6 hours/week chahiye for data review and SOP discussions." },
  ];

  return (
    <div className="content" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 28, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Client demo view</b> · Common questions from prospects</span>
        <Badge kind="info">E5 · FAQ</Badge>
      </div>

      <div className="page-head" style={{ textAlign: "center" }}>
        <div className="page-eyebrow">Frequently asked</div>
        <h1 className="page-title">Aapke questions ka jawab.</h1>
        <p className="page-sub" style={{ margin: "8px auto 0" }}>Ek baar dekho — most likely aapka question yahan hai.</p>
      </div>

      <div className="stack-8" style={{ marginTop: 32 }}>
        {faqs.map((f, i) => (
          <div key={i} className="card" style={{ padding: 0, overflow: "hidden", borderColor: open === i ? "var(--amber)" : "var(--hairline)" }}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              style={{ width: "100%", textAlign: "left", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
              <div className="row" style={{ gap: 12 }}>
                <span className="serif tnum" style={{ color: "var(--amber)", fontSize: 18, width: 28 }}>Q{i+1}.</span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{f.q}</span>
              </div>
              <I name={open === i ? "chevron_up" : "chevron_down"} size={16} />
            </button>
            {open === i && (
              <div style={{ padding: "0 20px 16px 60px", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <Card style={{ marginTop: 32, textAlign: "center", padding: 32, background: "var(--paper-2)" }}>
        <h3 className="serif" style={{ fontSize: 28, margin: "0 0 8px" }}>Aur questions hain?</h3>
        <p style={{ color: "var(--ink-3)" }}>WhatsApp pe ping karein — 30 mins me reply.</p>
        <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 16 }}>
          <Btn icon="whatsapp" kind="primary" style={{ background: "#25D366", borderColor: "#25D366" }}>WhatsApp Pardeep</Btn>
          <Btn icon="calendar">Schedule call</Btn>
        </div>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.faq = FaqScreen;
