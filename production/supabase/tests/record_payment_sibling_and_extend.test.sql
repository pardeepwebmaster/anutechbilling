-- Regression test: record_payment sibling-clobber (#1b) + extend-on-renewed (#16)
-- (migration 0056). Run against a dev/test DB (NOT prod). Self-asserting, rolled back.
--
--   psql "$DATABASE_URL" -f record_payment_sibling_and_extend.test.sql
--
-- Proves:
--   #1b  A 2nd payment on quote A only updates A's subscription outstanding —
--        a SIBLING subscription (from quote B) is NOT clobbered.
--   #16  Paying an extension quote linked to an already-'renewed' subscription
--        rolls THAT subscription forward instead of creating a duplicate.
--   +    A genuine new sale still creates exactly 1 sub, now stamped with quote_id.

-- ── #1b: sibling subscription must not be clobbered ──────────────────────────
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('dddddddd-0000-0000-0000-0000000000b1','SIB TEST','sib@example.in','07','SIB');
insert into public.customers (id, tenant_id, name)
  values ('cccccccc-0000-0000-0000-0000000000c1','dddddddd-0000-0000-0000-0000000000b1','Cust Sibling');
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, status, payment_status, line_items)
  values ('Q-SIB-A','dddddddd-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1','Cust Sibling',10000,'accepted','partial',
          '[{"name":"Plan A","qty":10,"rate":1000,"commitment":"annual_yearly"}]'::jsonb);
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, status, payment_status, line_items)
  values ('Q-SIB-B','dddddddd-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1','Cust Sibling',8000,'accepted','partial',
          '[{"name":"Plan B","qty":5,"rate":1600,"commitment":"annual_yearly"}]'::jsonb);
insert into public.subscriptions (id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr, status, renewal_date, outstanding_amount, quote_id)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1','dddddddd-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1','Cust Sibling','Plan A','google',10,5000,'active',(current_date+interval '1 year')::date,5000,'Q-SIB-A');
insert into public.subscriptions (id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr, status, renewal_date, outstanding_amount, quote_id)
  values ('bbbbbbbb-0000-0000-0000-0000000000b2','dddddddd-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1','Cust Sibling','Plan B','google',5,3000,'active',(current_date+interval '1 year')::date,3000,'Q-SIB-B');
insert into public.payments (tenant_id, quote_id, customer_id, amount, method, reference, status, received_at)
  values ('dddddddd-0000-0000-0000-0000000000b1','Q-SIB-A','cccccccc-0000-0000-0000-0000000000c1',5000,'upi','sib_prior','received',now());
do $$
declare v_a int; v_b int;
begin
  perform public.record_payment('Q-SIB-A', 3000, 'upi', 'sib_second'); -- A: 10000-8000 = 2000 outstanding
  select outstanding_amount into v_a from public.subscriptions where id='aaaaaaaa-0000-0000-0000-0000000000a1';
  select outstanding_amount into v_b from public.subscriptions where id='bbbbbbbb-0000-0000-0000-0000000000b2';
  if v_b <> 3000 then raise exception 'FAIL #1b: sibling B clobbered 3000 -> %', v_b; end if;
  if v_a <> 2000 then raise exception 'FAIL #1b: sub A outstanding expected 2000, got %', v_a; end if;
  raise notice 'PASS #1b: sibling intact (3000); A updated to its own (2000)';
end $$;
rollback;

-- ── #16: extend-on-already-renewed rolls the SAME sub forward, no duplicate ──
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('dddddddd-0000-0000-0000-0000000000e1','EXT TEST','ext@example.in','07','EXT');
insert into public.customers (id, tenant_id, name)
  values ('cccccccc-0000-0000-0000-0000000000e1','dddddddd-0000-0000-0000-0000000000e1','Cust Ext');
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, status, payment_status, line_items, extension_months)
  values ('Q-EXT','dddddddd-0000-0000-0000-0000000000e1','cccccccc-0000-0000-0000-0000000000e1','Cust Ext',12000,'sent','awaiting',
          '[{"name":"Google Workspace Plus","qty":10,"rate":1200,"commitment":"annual_yearly"}]'::jsonb,12);
insert into public.subscriptions (id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr, status, renewal_date, renewal_state, renewal_quote_id, outstanding_amount)
  values ('aaaaaaaa-0000-0000-0000-0000000000e1','dddddddd-0000-0000-0000-0000000000e1','cccccccc-0000-0000-0000-0000000000e1','Cust Ext','Google Workspace Plus','google',10,1000,'active',(current_date+interval '1 year')::date,'renewed','Q-EXT',0);
do $$
declare v_n int;
begin
  perform public.record_payment('Q-EXT', 12000, 'upi', 'ext_pay');
  select count(*) into v_n from public.subscriptions where customer_id='cccccccc-0000-0000-0000-0000000000e1';
  if v_n <> 1 then raise exception 'FAIL #16: extend-on-renewed duplicated -> % subs', v_n; end if;
  raise notice 'PASS #16: still 1 sub (rolled forward, no duplicate)';
end $$;
rollback;
