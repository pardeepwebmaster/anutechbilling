-- Regression test: tenant-scoped document IDs prevent cross-tenant collisions (migration 0054)
-- Run on a dev/test DB. Self-asserting; rolled back.
--   psql "$DATABASE_URL" -f tenant_scoped_document_ids.test.sql
--
-- Proves two tenants issuing the SAME sequence number get GLOBALLY-UNIQUE ids
-- (the per-tenant doc_code differentiates them), and a tenant with no doc_code
-- still gets a non-null, unique fallback code.

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, name, email, state_code, doc_code) values
  ('cafe0000-0000-0000-0000-000000000a01', 'Tenant Alpha', 'a@example.in', '07', 'ALFA'),
  ('cafe0000-0000-0000-0000-000000000b02', 'Tenant Beta',  'b@example.in', '27', 'BETA'),
  ('cafe0000-0000-0000-0000-000000000c03', 'No Code Co',   'c@example.in', '07', null);

do $$
declare a text; b text; c text; n integer;
begin
  a := public.next_document_number('quote', 'cafe0000-0000-0000-0000-000000000a01');
  b := public.next_document_number('quote', 'cafe0000-0000-0000-0000-000000000b02');
  c := public.next_document_number('quote', 'cafe0000-0000-0000-0000-000000000c03');

  -- both fresh tenants are on sequence 0001, but ids differ (different codes)
  if a = b then raise exception 'FAIL: two tenants got identical quote id % (collision!)', a; end if;
  if a !~ '^Q-ALFA-\d{4}-\d{2}-0001$' then raise exception 'FAIL: Alpha id wrong format: %', a; end if;
  if b !~ '^Q-BETA-\d{4}-\d{2}-0001$' then raise exception 'FAIL: Beta id wrong format: %', b; end if;
  -- tenant with null doc_code still gets a non-null, unique fallback code
  if c is null or c = a or c = b then raise exception 'FAIL: no-code tenant id bad: %', c; end if;
  if c !~ '^Q-[A-Z0-9]{1,8}-\d{4}-\d{2}-0001$' then raise exception 'FAIL: fallback id wrong format: %', c; end if;

  -- invoice doc type also carries the code
  if public.next_document_number('invoice','cafe0000-0000-0000-0000-000000000a01') !~ '^INV-ALFA-' then
    raise exception 'FAIL: invoice missing tenant code';
  end if;

  raise notice 'PASS: tenant-scoped ids unique across tenants (% vs % vs %)', a, b, c;
end $$;
rollback;
