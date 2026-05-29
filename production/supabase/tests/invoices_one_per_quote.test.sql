-- Regression test: at most one invoice per quote (migration 0053, audit bug #7)
--
-- Run against a dev/test DB (NOT prod). Self-asserting; rolled back.
--   psql "$DATABASE_URL" -f invoices_one_per_quote.test.sql
--
-- Proves a second invoice for the same quote is rejected by invoices_quote_unique.

begin;
insert into public.tenants (id, name, email, state_code)
  values ('bbbbbbbb-0000-0000-0000-0000000000b3', 'INV ONEPER TEST', 'invtest@example.in', '07');
insert into public.quotes (id, tenant_id, customer_name, amount, status, payment_status)
  values ('Q-INV-ONEPER', 'bbbbbbbb-0000-0000-0000-0000000000b3', 'Inv Cust', 5000, 'accepted', 'received');

insert into public.invoices (id, tenant_id, customer_name, amount, status, invoice_date, quote_id)
  values ('INV-ONEPER-A', 'bbbbbbbb-0000-0000-0000-0000000000b3', 'Inv Cust', 5000, 'pending', current_date, 'Q-INV-ONEPER');

do $$
declare n integer;
begin
  begin
    insert into public.invoices (id, tenant_id, customer_name, amount, status, invoice_date, quote_id)
      values ('INV-ONEPER-B', 'bbbbbbbb-0000-0000-0000-0000000000b3', 'Inv Cust', 5000, 'pending', current_date, 'Q-INV-ONEPER');
    raise exception 'FAIL: a second invoice for the same quote was allowed';
  exception when unique_violation then
    null; -- expected
  end;
  select count(*) into n from public.invoices where quote_id = 'Q-INV-ONEPER';
  if n <> 1 then
    raise exception 'FAIL: expected 1 invoice per quote, got %', n;
  end if;
  raise notice 'PASS: only one invoice per quote (duplicate blocked)';
end $$;
rollback;
