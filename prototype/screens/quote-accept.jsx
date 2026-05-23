/* eslint-disable */
// B3 — Quote Accept & Pay (customer view) — dynamic from window.__currentQuote stash

function QuoteAcceptScreen() {
  const [paid, setPaid] = useState(false);
  const { toast } = useToast();

  // Read the selected quote from stash, fall back to Q-2026-0042 (Acme upgrade)
  const stashQuoteId = window.__currentQuote || "Q-2026-0042";
  const quote = QUOTES.find(q => q.id === stashQuoteId) || QUOTES[0];

  // Match quote.customer against CUSTOMERS table (handle "Acme Corp Pvt Ltd" vs "Acme Corp Pvt Ltd")
  const matched = CUSTOMERS.find(c =>
    c.name === quote.customer ||
    c.name.replace(" Pvt Ltd", "") === quote.customer ||
    quote.customer.startsWith(c.name.split(" ").slice(0, 2).join(" "))
  );

  // For lead-converted quotes (customer not yet in CUSTOMERS), construct a minimal record
  const customer = matched || {
    name: quote.customer,
    state: "Maharashtra (27)", // default — most leads are Maharashtra
    contact: { name: "there", title: "", email: "", phone: "" },
  };

  const items = planToItems(quote.plan, quote.seats);

  // Compute totals from line items × 12 months
  const monthlySubtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const subtotal = monthlySubtotal * 12;
  const discountPct = 10;
  const discount = Math.round(subtotal * (discountPct / 100));
  const taxable = subtotal - discount;
  const taxRate = 18;
  const tax = Math.round(taxable * (taxRate / 100));
  const total = taxable + tax;
  const interState = customer.state !== RESELLER.state;
  const cgst = Math.round(tax / 2);
  const sgst = tax - cgst;

  const validUntil = quote.expires;

  if (paid) {
    return (
      <div className="content narrow" style={{ paddingTop: 80 }}>
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--emerald-soft)", color: "var(--emerald)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <I name="check" size={32} />
          </div>
          <h2 className="serif" style={{ fontSize: 30, margin: "0 0 8px" }}>Payment received.</h2>
          <p style={{ color: "var(--ink-3)" }}>Workspace provisioning will start within 24 hours. You'll get a setup link by email.</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 24, gap: 8 }}>
            <Btn icon="download">Download receipt</Btn>
            <Btn kind="primary" onClick={() => setPaid(false)}>Back to quote</Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="content narrow" style={{ padding: "40px 24px 80px" }}>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12, marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
        <span><b>Customer view</b> · The accept-and-pay page customers see via shared link</span>
        <Badge kind="info">B3 · Quote Accept & Pay</Badge>
      </div>

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 500 }}>{RESELLER.name.replace(" Pvt Ltd", "")}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Google Workspace Authorized Reseller · GSTIN {RESELLER.gstin}</div>
      </div>

      <div className="stack-12" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "var(--ink-3)" }}>Hi {customer.contact.name.split(" ")[0]},</div>
        <div style={{ fontSize: 16 }}>Here is your quotation for <b>{quote.plan}</b>.</div>
      </div>

      <Card flush>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--hairline)" }}>
          <div>
            <div className="serif" style={{ fontSize: 20 }}>{quote.id}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>For {customer.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Valid until</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{validUntil}</div>
          </div>
        </div>

        <table className="tbl">
          <thead><tr><th>Product</th><th>HSN</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td><b>{it.name}</b>{it.sub && <div className="sub">{it.sub}</div>}</td>
                <td className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{it.hsn}</td>
                <td className="right tnum">{it.qty}</td>
                <td className="right tnum">{rupee(it.rate)}/mo</td>
                <td className="right tnum" style={{ fontWeight: 500 }}>{rupee(it.qty * it.rate)}/mo</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: "20px 20px 24px", background: "var(--paper-2)", borderTop: "1px solid var(--hairline)" }}>
          <div style={{ maxWidth: 320, marginLeft: "auto" }} className="stack-8">
            <TotalsRow label="Subtotal (annual)" value={rupee(subtotal)} />
            <TotalsRow label={`Discount (${discountPct}%)`} value={`−${rupee(discount)}`} tone="emerald" />
            <TotalsRow label="Taxable amount" value={rupee(taxable)} />
            {interState ? (
              <TotalsRow label={`IGST (${taxRate}%)`} value={rupee(tax)} />
            ) : (
              <>
                <TotalsRow label={`CGST (${taxRate / 2}%)`} value={rupee(cgst)} />
                <TotalsRow label={`SGST (${taxRate / 2}%)`} value={rupee(sgst)} />
              </>
            )}
            <div style={{ paddingTop: 12, borderTop: "1px solid var(--hairline-strong)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-3)", fontWeight: 600 }}>Total payable</span>
              <span className="serif tnum" style={{ fontSize: 32, color: "var(--amber)" }}>{rupee(total)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <Btn kind="primary" size="lg" icon="check_circle" onClick={() => setPaid(true)} style={{ padding: "14px 20px", justifyContent: "center", fontSize: 14 }}>
          Accept & pay via Razorpay
        </Btn>
        <Btn kind="default" size="lg" icon="message" onClick={() => toast("Opening WhatsApp chat")} style={{ padding: "14px 20px", justifyContent: "center", fontSize: 14 }}>
          Discuss or modify
        </Btn>
      </div>

      <p style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 13, marginTop: 18, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
        Once payment is received, your Workspace will be provisioned within 24 hours. We'll guide you through DNS and admin setup.
      </p>

      <div className="row" style={{ justifyContent: "center", marginTop: 32, gap: 8 }}>
        <Btn kind="ghost" size="sm" icon="download">Download PDF</Btn>
        <Btn kind="ghost" size="sm" icon="mail">Email me a copy</Btn>
        <Btn kind="ghost" size="sm" icon="question">Got a question?</Btn>
      </div>
    </div>
  );
}

function TotalsRow({ label, value, tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
      <span className="tnum" style={{ color: tone ? `var(--${tone})` : undefined }}>{value}</span>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS["quote-accept"] = QuoteAcceptScreen;
