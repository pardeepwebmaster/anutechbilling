-- Regression test: place-of-supply (state) flows lead → customer on conversion
-- (migration 0055, audit bug #18-20).
--
-- Run against a dev/test DB (NOT prod). Self-asserting (RAISEs on failure),
-- inside a rolled-back transaction so the DB stays clean.
--
--   psql "$DATABASE_URL" -f lead_state_to_customer.test.sql
--
-- Proves:
--   record_payment(), when it converts a buy-page lead → customer, copies the
--   lead's state_code / state / gstin onto the new customer. Without this the
--   customer started stateless and every buy-page sale defaulted to intra-state
--   (CGST+SGST) even for an inter-state (IGST) buyer.
--
-- NOTE on accept_quote(): it derives the tenant from current_tenant_id() (an
-- authenticated session), so it can't be driven by the service_role JWT shim
-- used here. Its identical state-copy is exercised by the in-app E2E test
-- (Maharashtra lead → Mark accepted → customer.state_code = 27).

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, name, email, state_code, doc_code)
  values ('dddddddd-0000-0000-0000-0000000000f1', 'FU1 SELLER (Delhi)', 'fu1@example.in', '07', 'FU1');

-- Inter-state buyer: Maharashtra (27) vs Delhi (07) seller → must become IGST.
insert into public.leads (id, tenant_id, company, contact_name, contact_email, stage, source, state_code, state, gstin)
  values ('L-FU1TEST', 'dddddddd-0000-0000-0000-0000000000f1', 'FU1 Buyer Co', 'QA', 'qa@example.in',
          'new', 'buy-workspace', '27', 'Maharashtra (27)', '27AABCM1234N1Z5');

insert into public.quotes (id, tenant_id, customer_id, customer_name, lead_id, amount, status, payment_status, line_items, tax_rate)
  values ('Q-FU1TEST', 'dddddddd-0000-0000-0000-0000000000f1', null, 'FU1 Buyer Co', 'L-FU1TEST', 12000, 'sent', 'awaiting',
          '[{"name":"Google Workspace Standard","qty":10,"rate":1200,"commitment":"annual_yearly"}]'::jsonb, 18);

do $$
declare v_cust uuid; v_sc text; v_st text; v_gst text; v_n int;
begin
  perform public.record_payment('Q-FU1TEST', 12000, 'upi', 'fu1_ref_01');
  select customer_id into v_cust from public.quotes where id = 'Q-FU1TEST';
  select state_code, state, gstin into v_sc, v_st, v_gst from public.customers where id = v_cust;

  if v_sc is distinct from '27' then
    raise exception 'FAIL: customer.state_code expected 27, got %', coalesce(v_sc, '<null>');
  end if;
  if v_st is distinct from 'Maharashtra (27)' then
    raise exception 'FAIL: customer.state expected "Maharashtra (27)", got %', coalesce(v_st, '<null>');
  end if;
  if v_gst is distinct from '27AABCM1234N1Z5' then
    raise exception 'FAIL: customer.gstin not copied, got %', coalesce(v_gst, '<null>');
  end if;
  select count(*) into v_n from public.subscriptions where customer_id = v_cust;
  if v_n <> 1 then
    raise exception 'FAIL: expected 1 subscription (spine intact), got %', v_n;
  end if;

  raise notice 'PASS: record_payment copied lead state(27)/gstin -> customer; spine still 1 subscription';
end $$;
rollback;
