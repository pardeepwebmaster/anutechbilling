-- Rolled-back test: after the billing-cycle decouple (migration 0161), record_payment's
-- "create a subscription?" gate must still key off the line's PRICE TIER
-- (commitment is distinct from 'monthly'), NOT the new quote-level billing_cycle
-- frequency. Proves the money gate is unaffected by the decouple.
--
-- Proves:
--   ANNUAL price tier + billing_cycle='quarterly' → subscription IS created (gate survives).
--   MONTHLY-flex price tier                       → NO subscription (unchanged).
--
-- Runs as service_role inside a DO block that RAISES at the end → full rollback.
--
-- Expected:
--   ANNUAL+quarterly: sub_created=true  subs_rows=1
--   FLEX-monthly:     sub_created=false subs_rows=0

do $$
declare
  v_tenant uuid := 'fbb976f1-9090-4f10-9726-0901bd144e42';  -- Anutech Digital
  v_cust   uuid := '53db44e6-6e90-4fec-8871-8d2288393a2a';
  v_annual jsonb := '[{"name":"GW Business","commitment":"annual_yearly","qty":10,"rate":3240,"cost":2700}]'::jsonb;
  v_flex   jsonb := '[{"name":"GW Business","commitment":"monthly","qty":10,"rate":3240,"cost":2700}]'::jsonb;
  r jsonb;
  v_msg text := '';
  v_annual_subs int;
  v_flex_subs int;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Annual price tier + QUARTERLY billing cycle → subscription still created.
  insert into quotes(id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, line_items, status, payment_status, is_one_off, billing_cycle)
    values ('TESTQ-BC-ANNUAL', v_tenant, v_cust, 'TEST', 11800, 10000, 18, v_annual, 'sent', 'awaiting', false, 'quarterly');
  r := record_payment('TESTQ-BC-ANNUAL', 11800, 'upi', 'REF-BC-ANNUAL', null);
  select count(*) into v_annual_subs from subscriptions where quote_id = 'TESTQ-BC-ANNUAL';
  v_msg := v_msg || format('ANNUAL+quarterly: sub_created=%s subs_rows=%s (expect true/1) | ', r->>'subscription_created', v_annual_subs);

  -- Monthly-flex price tier → still NO subscription.
  insert into quotes(id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, line_items, status, payment_status, is_one_off, billing_cycle)
    values ('TESTQ-BC-FLEX', v_tenant, v_cust, 'TEST', 11800, 10000, 18, v_flex, 'sent', 'awaiting', false, 'monthly');
  r := record_payment('TESTQ-BC-FLEX', 11800, 'upi', 'REF-BC-FLEX', null);
  select count(*) into v_flex_subs from subscriptions where quote_id = 'TESTQ-BC-FLEX';
  v_msg := v_msg || format('FLEX-monthly: sub_created=%s subs_rows=%s (expect false/0)', r->>'subscription_created', v_flex_subs);

  raise exception 'TESTRESULT >> %', v_msg;
end $$;
