-- Regression test: zero/NULL-amount guards (migrations 0060/0061, bugs #26, #27).
-- Run on a dev/test DB. Self-asserting; rolled back.
--
-- Proves:
--   #27 record_payment rejects a payment against a ₹0/NULL-amount quote (no
--       payment row, no mrr=0 subscription) — but still records normally for a
--       priced quote (no regression).
--   #26 generate_invoice refuses to issue a ₹0 tax invoice — but still issues a
--       paid invoice for a priced, fully-paid quote (no regression).

-- ── #27: record_payment rejects ₹0 quote ───────────────────────────────────
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('dddddddd-0000-0000-0000-0000000000d1','RP ZERO','rpz@example.in','07','RPZ1');
insert into public.customers (id, tenant_id, name)
  values ('cccccccc-0000-0000-0000-0000000000d1','dddddddd-0000-0000-0000-0000000000d1','Cust Z');
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, status, payment_status, line_items)
  values ('Q-RP-ZERO','dddddddd-0000-0000-0000-0000000000d1','cccccccc-0000-0000-0000-0000000000d1','Cust Z',0,0,18,'sent','awaiting','[]'::jsonb);
do $$
declare v_err boolean := false; n int;
begin
  begin perform public.record_payment('Q-RP-ZERO', 5000, 'upi', 'z_ref');
  exception when others then v_err := true; end;
  if not v_err then raise exception 'FAIL #27: record_payment did NOT reject ₹0 quote'; end if;
  select count(*) into n from public.payments where quote_id='Q-RP-ZERO';
  if n <> 0 then raise exception 'FAIL #27: ₹0 quote got % payment rows', n; end if;
  raise notice 'PASS #27: ₹0-quote payment rejected, no payment row';
end $$;
rollback;

-- ── #26: generate_invoice refuses ₹0 invoice ───────────────────────────────
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('eeeeeeee-0000-0000-0000-0000000000c1','GI ZERO','giz@example.in','07','GIZ1');
insert into public.customers (id, tenant_id, name)
  values ('cccccccc-0000-0000-0000-0000000000c1','eeeeeeee-0000-0000-0000-0000000000c1','Cust Zero');
insert into public.document_series (tenant_id, doc_type, fiscal_year, prefix, last_number)
  values ('eeeeeeee-0000-0000-0000-0000000000c1','invoice', public.indian_fiscal_year(current_date), 'INV', 0);
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, status, payment_status, line_items)
  values ('Q-GI-ZERO','eeeeeeee-0000-0000-0000-0000000000c1','cccccccc-0000-0000-0000-0000000000c1','Cust Zero',0,0,18,'sent','awaiting','[]'::jsonb);
do $$
declare v_err boolean := false; n int;
begin
  begin perform public.generate_invoice('Q-GI-ZERO');
  exception when others then v_err := true; end;
  if not v_err then raise exception 'FAIL #26: generate_invoice did NOT reject ₹0 quote'; end if;
  select count(*) into n from public.invoices where quote_id='Q-GI-ZERO';
  if n <> 0 then raise exception 'FAIL #26: ₹0 quote got % invoices', n; end if;
  raise notice 'PASS #26: ₹0 tax-invoice refused, no invoice';
end $$;
rollback;
