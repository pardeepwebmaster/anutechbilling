-- Rolled-back test for create_direct_invoice (0158).
--
-- Proves a direct one-off invoice is GST-correct and does NOT create recurring
-- artefacts:
--   DOMESTIC (India)  → 18% split, pending, quote.is_one_off = true, 0 subscriptions.
--   EXPORT   (Kuwait) → zero-rated (rate 0, tax 0), net = subtotal.
--
-- Runs as service_role inside a DO block that RAISES at the end → full rollback.
-- (The customer's country is toggled inside the txn and reverts on rollback.)
--
-- Expected:
--   DOMESTIC: taxable=10000 tax=1800 rate=18 net=11800 status=pending one_off=t subs=0
--   EXPORT:   taxable=10000 tax=0 rate=0 net=10000

do $$
declare
  v_cust uuid := '53db44e6-6e90-4fec-8871-8d2288393a2a';  -- Anutech customer
  v_li jsonb := '[{"name":"Setup fee","qty":1,"rate":10000}]'::jsonb;
  r record;
  inv record;
  v_subs int;
  v_isoneoff boolean;
  v_msg text := '';
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  update customers set country = 'India' where id = v_cust;
  select * into r from create_direct_invoice(v_cust, v_li, 'test domestic');
  select taxable_value, tax_amount, tax_rate, net_payable, status into inv from invoices where id = r.invoice_id;
  select is_one_off into v_isoneoff from quotes where id = r.quote_id;
  select count(*) into v_subs from subscriptions where quote_id = r.quote_id;
  v_msg := v_msg || format('DOMESTIC: taxable=%s tax=%s rate=%s net=%s status=%s one_off=%s subs=%s (expect 10000/1800/18/11800/pending/t/0) | ',
    inv.taxable_value, inv.tax_amount, inv.tax_rate, inv.net_payable, inv.status, v_isoneoff, v_subs);

  update customers set country = 'Kuwait' where id = v_cust;
  select * into r from create_direct_invoice(v_cust, v_li, 'test export');
  select taxable_value, tax_amount, tax_rate, net_payable, status into inv from invoices where id = r.invoice_id;
  v_msg := v_msg || format('EXPORT: taxable=%s tax=%s rate=%s net=%s (expect 10000/0/0/10000)',
    inv.taxable_value, inv.tax_amount, inv.tax_rate, inv.net_payable);

  raise exception 'TESTRESULT >> %', v_msg;
end $$;
