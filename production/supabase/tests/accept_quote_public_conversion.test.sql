-- Regression test: accept_quote() is public/service-role safe and converts the
-- linked lead → customer (migration 0059, audit bug #17).
-- Run on a dev/test DB. Self-asserting; rolled back.
--
-- Proves:
--   1. Service-role context (current_tenant_id() IS NULL, as the public accept
--      route runs): accept_quote converts lead→customer, marks lead 'won', sets
--      quote accepted + payment_status='awaiting', converted_now=true.
--   2. Quote that already has a customer: no duplicate customer, converted_now
--      =false, still flips to accepted.

-- ── 1) Public/service-role accept converts the lead ─────────────────────────
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('eeeeeeee-0000-0000-0000-0000000000b1','AQ CONV','aq1@example.in','07','AQB1');
insert into public.leads (id, tenant_id, company, contact_name, contact_email, contact_phone, stage, source, priority, state_code, state)
  values ('L-AQ-1','eeeeeeee-0000-0000-0000-0000000000b1','Acme Co','Raj','raj@acme.in','+919800000001','quote','manual','medium','27','Maharashtra');
insert into public.quotes (id, tenant_id, lead_id, customer_id, customer_name, amount, subtotal, tax_rate, status, payment_status, line_items)
  values ('Q-AQ-CONV','eeeeeeee-0000-0000-0000-0000000000b1','L-AQ-1',null,'Acme Co',122342,103680,18,'sent','none',
          '[{"name":"Google Workspace Standard","qty":10,"rate":10368,"commitment":"annual_yearly"}]'::jsonb);
do $$
declare
  v_res jsonb; v_cust uuid; v_custcount int; v_qstatus text; v_qpay text; v_leadstage text; v_custstate text;
begin
  v_res := public.accept_quote('Q-AQ-CONV');
  if (v_res->>'converted_now')::boolean is not true then raise exception 'FAIL conv: converted_now expected true, got %', v_res->>'converted_now'; end if;

  v_cust := (v_res->>'customer_id')::uuid;
  if v_cust is null then raise exception 'FAIL conv: customer_id null'; end if;

  select count(*), max(state_code) into v_custcount, v_custstate from public.customers where id=v_cust;
  if v_custcount <> 1 then raise exception 'FAIL conv: expected 1 customer, got %', v_custcount; end if;
  if v_custstate <> '27' then raise exception 'FAIL conv: customer state_code expected 27, got %', v_custstate; end if;

  select status::text, payment_status::text, customer_id into v_qstatus, v_qpay, v_cust from public.quotes where id='Q-AQ-CONV';
  if v_qstatus <> 'accepted' then raise exception 'FAIL conv: quote status expected accepted, got %', v_qstatus; end if;
  if v_qpay <> 'awaiting'    then raise exception 'FAIL conv: quote payment_status expected awaiting, got %', v_qpay; end if;

  select stage::text into v_leadstage from public.leads where id='L-AQ-1';
  if v_leadstage <> 'won' then raise exception 'FAIL conv: lead stage expected won, got %', v_leadstage; end if;

  raise notice 'PASS public-accept: lead converted→customer (state 27), quote accepted+awaiting, lead won';
end $$;
rollback;

-- ── 2) Quote that already has a customer → no duplicate, converted_now false ──
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('eeeeeeee-0000-0000-0000-0000000000b2','AQ EXIST','aq2@example.in','07','AQB2');
insert into public.customers (id, tenant_id, name)
  values ('cccccccc-0000-0000-0000-0000000000b2','eeeeeeee-0000-0000-0000-0000000000b2','Existing Cust');
insert into public.quotes (id, tenant_id, lead_id, customer_id, customer_name, amount, subtotal, tax_rate, status, payment_status, line_items)
  values ('Q-AQ-EXIST','eeeeeeee-0000-0000-0000-0000000000b2',null,'cccccccc-0000-0000-0000-0000000000b2','Existing Cust',122342,103680,18,'sent','none',
          '[{"name":"Google Workspace Standard","qty":10,"rate":10368,"commitment":"annual_yearly"}]'::jsonb);
do $$
declare v_res jsonb; v_qstatus text;
begin
  v_res := public.accept_quote('Q-AQ-EXIST');
  if (v_res->>'converted_now')::boolean is not false then raise exception 'FAIL exist: converted_now expected false, got %', v_res->>'converted_now'; end if;
  if (v_res->>'customer_id')::uuid <> 'cccccccc-0000-0000-0000-0000000000b2' then raise exception 'FAIL exist: customer_id changed'; end if;
  select status::text into v_qstatus from public.quotes where id='Q-AQ-EXIST';
  if v_qstatus <> 'accepted' then raise exception 'FAIL exist: status expected accepted, got %', v_qstatus; end if;
  raise notice 'PASS existing-customer accept: no duplicate, converted_now=false, accepted';
end $$;
rollback;
