-- Rolled-back test for create_project_direct_invoice (0160).
--
-- Proves a direct PROJECT invoice composes create → accept → raise atomically and
-- is GST-correct:
--   • project ends 'active', a pending GST tax invoice is raised for the full amount.
--
-- create_project_quote needs a real tenant context (it is NOT service-role aware),
-- so we set request.jwt.claim.sub to a real Anutech user. The DO block RAISES at
-- the end → full rollback (nothing persists).
--
-- Expected: taxable=200000 tax=36000 rate=18 amount=236000 status=pending net=236000 project=active

do $$
declare
  v_cust uuid := '53db44e6-6e90-4fec-8871-8d2288393a2a';  -- Anutech customer
  v_li jsonb := '[{"name":"Custom software","qty":1,"rate":200000,"amount":200000}]'::jsonb;
  r record; inv record; v_msg text; v_proj_status text;
begin
  -- Real Anutech user so current_tenant_id() resolves inside create_project_quote.
  perform set_config('request.jwt.claim.sub', '3caa0f07-44d1-42ee-91b3-2123e04853b1', true);
  perform set_config('request.jwt.claims', '{"sub":"3caa0f07-44d1-42ee-91b3-2123e04853b1","role":"authenticated"}', true);

  select * into r from create_project_direct_invoice(v_cust, 'TEST', 'TEST Project', null, v_li, 18, false);
  select taxable_value, tax_amount, tax_rate, amount, status, net_payable into inv from invoices where id=r.invoice_id;
  select status into v_proj_status from project_sales where id=r.project_id;
  v_msg := format('PROJECT INV: taxable=%s tax=%s rate=%s amount=%s status=%s net=%s project=%s (expect 200000/36000/18/236000/pending/236000/active)',
    inv.taxable_value, inv.tax_amount, inv.tax_rate, inv.amount, inv.status, inv.net_payable, v_proj_status);
  raise exception 'TESTRESULT >> %', v_msg;
end $$;
