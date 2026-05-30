-- Regression tests: renewal roll-forward + monthly-flex subscription behaviour
-- Use-cases R-07 and P-05 (see docs/SPINE-TEST-USE-CASES.md). Run on a dev/test
-- DB (NOT prod). Self-asserting (RAISEs on failure); each in a rolled-back txn.
--   psql "$DATABASE_URL" -f renewal_and_subscription_creation.test.sql

-- ── R-07: paying a renewal quote rolls the EXISTING sub forward (no new sub) ──
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, name, email, state_code)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'REN TEST', 'ren@example.in', '07');
insert into public.customers (id, tenant_id, name)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Ren Cust');
-- seed PO series high so the roll-forward's auto-PO doesn't hit the global PO-id collision
insert into public.document_series (tenant_id, doc_type, fiscal_year, prefix, last_number)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'purchase_order', public.indian_fiscal_year(current_date), 'PO', 990000);
-- quote FIRST (subscription.renewal_quote_id FKs to it)
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, status, payment_status, line_items)
  values ('Q-REN-T', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Ren Cust', 103680, 'sent', 'awaiting',
          '[{"name":"Google Workspace Standard","qty":10,"rate":10368,"commitment":"annual_yearly"}]'::jsonb);
insert into public.subscriptions (id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr, status, renewal_date, renewal_state, renewal_quote_id)
  values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
          'Ren Cust', 'Google Workspace Standard', 'google', 10, 7200, 'active', current_date, 'reminder_2', 'Q-REN-T');

do $$
declare n integer; st text; advanced boolean; cleared boolean;
begin
  perform public.record_payment('Q-REN-T', 103680, 'razorpay', 'rzp_ren');
  select count(*), max(renewal_state),
         bool_and(renewal_date = (current_date + interval '12 months')::date),
         bool_and(renewal_quote_id is null)
    into n, st, advanced, cleared
    from public.subscriptions where customer_id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  if n <> 1 then raise exception 'FAIL renewal: expected 1 sub (no duplicate), got %', n; end if;
  if st <> 'renewed' then raise exception 'FAIL renewal: expected renewal_state=renewed, got %', st; end if;
  if not advanced then raise exception 'FAIL renewal: renewal_date not advanced 12 months'; end if;
  if not cleared then raise exception 'FAIL renewal: renewal_quote_id not cleared'; end if;
  raise notice 'PASS R-07: renewal rolled forward, 1 sub, +12mo, renewed';
end $$;
rollback;

-- ── P-05: monthly-flex sale creates NO subscription (documents current behaviour) ──
-- NOTE: this asserts CURRENT behaviour. Whether a monthly-flex sale SHOULD create a
-- (monthly) subscription is open question #29 — if that changes, update this test.
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code)
  values ('aaaaaaaa-0000-0000-0000-0000000000a2', 'FLEX TEST', 'flex@example.in', '07');
insert into public.customers (id, tenant_id, name)
  values ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'Flex Cust');
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, status, payment_status, line_items)
  values ('Q-FLEX-T', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c2', 'Flex Cust', 3900, 'sent', 'awaiting',
          '[{"name":"Google Workspace Standard","qty":5,"rate":780,"commitment":"monthly"}]'::jsonb);
do $$
declare n integer;
begin
  perform public.record_payment('Q-FLEX-T', 3900, 'razorpay', 'rzp_flex');
  select count(*) into n from public.subscriptions where customer_id = 'aaaaaaaa-0000-0000-0000-0000000000c2';
  if n <> 0 then raise exception 'FAIL monthly-flex: expected 0 subs (flex = no annual sub), got %', n; end if;
  raise notice 'PASS P-05: monthly-flex sale created no subscription (current behaviour)';
end $$;
rollback;
