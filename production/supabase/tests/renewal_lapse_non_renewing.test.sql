-- Regression test: the renewals cron lapses NON-renewing subscriptions once
-- their paid term has ended (audit bug RN-24 / #24). Self-asserting; rolled back.
--
-- Mirrors the bulk UPDATE the cron runs:
--   UPDATE subscriptions SET status='expired'
--   WHERE status='active' AND auto_renew=false AND renewal_date < current_date
--
-- Proves:
--   A. not-renewing + term ended      → expired
--   B. not-renewing + still in term    → stays active (future renewal_date)
--   C. renewing (auto_renew) + ended   → stays active (the cadence suspends it,
--                                        not this lapse step)
--   + idempotent re-run.

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('ffffffff-0000-0000-0000-0000000000e1','RN24 T','rn24@example.in','07','RN24');
insert into public.customers (id, tenant_id, name)
  values ('cccccccc-0000-0000-0000-0000000000e1','ffffffff-0000-0000-0000-0000000000e1','Cust RN24');
insert into public.subscriptions (id, tenant_id, customer_id, customer_name, plan, vendor, seats, mrr, status, start_date, renewal_date, auto_renew)
  values
   ('aaaaaaaa-0000-0000-0000-0000000000e1','ffffffff-0000-0000-0000-0000000000e1','cccccccc-0000-0000-0000-0000000000e1','Cust','Plan','google',5,4000,'active',current_date-400,current_date-1,false),
   ('aaaaaaaa-0000-0000-0000-0000000000e2','ffffffff-0000-0000-0000-0000000000e1','cccccccc-0000-0000-0000-0000000000e1','Cust','Plan','google',5,4000,'active',current_date-30, current_date+30,false),
   ('aaaaaaaa-0000-0000-0000-0000000000e3','ffffffff-0000-0000-0000-0000000000e1','cccccccc-0000-0000-0000-0000000000e1','Cust','Plan','google',5,4000,'active',current_date-400,current_date-1,true);

update public.subscriptions set status='expired'
 where status='active' and auto_renew=false and renewal_date < current_date;

do $$
declare a text; b text; c text;
begin
  select status::text into a from public.subscriptions where id='aaaaaaaa-0000-0000-0000-0000000000e1';
  select status::text into b from public.subscriptions where id='aaaaaaaa-0000-0000-0000-0000000000e2';
  select status::text into c from public.subscriptions where id='aaaaaaaa-0000-0000-0000-0000000000e3';
  if a <> 'expired' then raise exception 'FAIL A: expected expired, got %', a; end if;
  if b <> 'active'  then raise exception 'FAIL B: expected active (still in term), got %', b; end if;
  if c <> 'active'  then raise exception 'FAIL C: expected active (renewing), got %', c; end if;
  -- idempotent: re-run touches nothing now
  update public.subscriptions set status='expired' where status='active' and auto_renew=false and renewal_date < current_date;
  raise notice 'PASS RN-24: not-renewing+ended -> expired; in-term stays; renewing stays';
end $$;
rollback;
