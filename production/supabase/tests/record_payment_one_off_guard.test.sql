-- Rolled-back test for the one-off (direct-invoice) guard in record_payment (0157).
--
-- Proves:
--   ONE-OFF (quotes.is_one_off = true)  → payment records but NO subscription is created.
--   NORMAL  (quotes.is_one_off = false) → subscription IS still created (regression guard).
--
-- Runs record_payment as service_role (skips the tenant-JWT check) inside a DO block
-- that RAISES at the end, so the whole transaction rolls back — nothing persists.
--
-- Expected:
--   ONE-OFF: subscription_created=false subs_rows=0
--   NORMAL:  subscription_created=true  subs_rows=1

do $$
declare
  v_tenant uuid := 'fbb976f1-9090-4f10-9726-0901bd144e42';  -- Anutech Digital
  v_cust   uuid := '53db44e6-6e90-4fec-8871-8d2288393a2a';
  v_li jsonb := '[{"name":"Google Workspace Business","commitment":"annual_yearly","qty":10,"rate":3240,"cost":2700}]'::jsonb;
  r jsonb;
  v_msg text := '';
  v_oneoff_subs int;
  v_normal_subs int;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into quotes(id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, line_items, status, payment_status, is_one_off)
    values ('TESTQ-ONEOFF', v_tenant, v_cust, 'TEST', 11800, 10000, 18, v_li, 'sent', 'awaiting', true);
  r := record_payment('TESTQ-ONEOFF', 11800, 'upi', 'REF-ONEOFF-1', null);
  select count(*) into v_oneoff_subs from subscriptions where quote_id = 'TESTQ-ONEOFF';
  v_msg := v_msg || format('ONE-OFF: subscription_created=%s subs_rows=%s (expect false/0) | ', r->>'subscription_created', v_oneoff_subs);

  insert into quotes(id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, line_items, status, payment_status, is_one_off)
    values ('TESTQ-NORMAL', v_tenant, v_cust, 'TEST', 11800, 10000, 18, v_li, 'sent', 'awaiting', false);
  r := record_payment('TESTQ-NORMAL', 11800, 'upi', 'REF-NORMAL-1', null);
  select count(*) into v_normal_subs from subscriptions where quote_id = 'TESTQ-NORMAL';
  v_msg := v_msg || format('NORMAL: subscription_created=%s subs_rows=%s (expect true/1)', r->>'subscription_created', v_normal_subs);

  raise exception 'TESTRESULT >> %', v_msg;
end $$;
