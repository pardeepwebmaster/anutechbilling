-- Regression test: a portal customer cannot re-point their own customer_users
-- link to another customer (migration 0064 — cross-customer escalation hole).
-- Self-asserting; rolled back. Uses `set role authenticated` so RLS is actually
-- enforced (the MCP/owner connection would otherwise bypass RLS).
--
-- Borrows a real auth.users id for the customer_users FK (rolled back).
--
-- Proves:
--   1. As the authenticated customer, UPDATE customer_users SET customer_id=<victim>
--      affects 0 rows (no self-update policy) → link stays pointed at own customer.
--   2. portal_touch_login() still stamps last_login_at on the caller's own row.

begin;
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('ffffffff-0000-0000-0000-0000000000a7','SEC T','sec@example.in','07','SEC1');
insert into public.customers (id, tenant_id, name)
  values ('cccccccc-0000-0000-0000-0000000000a7','ffffffff-0000-0000-0000-0000000000a7','Cust A'),
         ('cccccccc-0000-0000-0000-0000000000a8','ffffffff-0000-0000-0000-0000000000a7','Cust B (victim)');
insert into public.customer_users (auth_user_id, customer_id, tenant_id, email, role, last_login_at)
  select id, 'cccccccc-0000-0000-0000-0000000000a7','ffffffff-0000-0000-0000-0000000000a7','a@sec.in','admin','2020-01-01T00:00:00Z'
  from auth.users limit 1;

set local role authenticated;
do $$
declare v_uid text; v_cnt int;
begin
  select auth_user_id::text into v_uid from public.customer_users where customer_id='cccccccc-0000-0000-0000-0000000000a7';
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role','authenticated')::text, true);

  update public.customer_users set customer_id='cccccccc-0000-0000-0000-0000000000a8' where auth_user_id::text = v_uid;
  get diagnostics v_cnt = row_count;
  if v_cnt <> 0 then raise exception 'FAIL: exploit updated % row(s) — customer could re-point their link', v_cnt; end if;

  perform public.portal_touch_login();
end $$;
reset role;

do $$
declare v_cid uuid; v_ll timestamptz;
begin
  select customer_id, last_login_at into v_cid, v_ll from public.customer_users
   where customer_id in ('cccccccc-0000-0000-0000-0000000000a7','cccccccc-0000-0000-0000-0000000000a8')
   order by 1 limit 1;
  if v_cid <> 'cccccccc-0000-0000-0000-0000000000a7' then raise exception 'FAIL: link customer_id changed to % (cross-customer leak!)', v_cid; end if;
  if v_ll <= '2020-01-02T00:00:00Z' then raise exception 'FAIL: last_login_at not stamped by RPC (%)', v_ll; end if;
  raise notice 'PASS: link intact (no escalation) + last_login stamped via portal_touch_login';
end $$;
rollback;
