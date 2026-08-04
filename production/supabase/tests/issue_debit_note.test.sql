-- Regression test: issue_debit_note (migration 0155, CGST §34) — mirror of the
-- credit note; RAISES an invoice.
--
-- Run against a dev/test DB (NOT prod). Self-asserting: RAISEs on failure.
-- Everything runs inside a transaction that ROLLS BACK.
--
-- What it proves:
--   1. A debit note freezes the correct GST split (mirrors the invoice's rate)
--      and gets a DN number.
--   2. It RAISES the invoice's net owed — even ABOVE the original invoice amount
--      (the relaxed net_payable constraint allows this).
--   3. An export / zero-rated invoice (rate 0) yields a zero-rated debit note.

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, name, email, state_code)
  values ('dddddddd-0000-0000-0000-0000000d00a1'::uuid, 'DEBIT NOTE TEST', 'dn-test@example.in', '07');

insert into public.invoices (id, tenant_id, customer_name, amount, status, invoice_date, net_payable, taxable_value, tax_amount, tax_rate, inter_state)
  values ('INV-DNT-DOM', 'dddddddd-0000-0000-0000-0000000d00a1'::uuid, 'Dom Cust', 11800, 'pending', current_date, 11800, 10000, 1800, 18, false);
insert into public.invoices (id, tenant_id, customer_name, amount, status, invoice_date, net_payable, taxable_value, tax_amount, tax_rate, inter_state)
  values ('INV-DNT-EXP', 'dddddddd-0000-0000-0000-0000000d00a1'::uuid, 'Exp Cust', 5000, 'pending', current_date, 5000, 5000, 0, 0, false);

do $$
declare
  r1 jsonb; c record; n_net integer; n_rows integer;
  r_exp jsonb; c_exp record;
begin
  -- 1 + 2: ₹2,360 debit note (undercharged 2 seats) → net owed 11800 → 14160.
  r1 := public.issue_debit_note('INV-DNT-DOM', 2360, 'undercharge', 'billed 8 not 10 seats', null);

  select amount, taxable_value, tax_amount, tax_rate, inter_state into c
    from public.debit_notes where invoice_id = 'INV-DNT-DOM' limit 1;
  select count(*) into n_rows from public.debit_notes where invoice_id = 'INV-DNT-DOM';
  select net_payable into n_net from public.invoices where id = 'INV-DNT-DOM';

  if (r1->>'debit_note_id') is null then raise exception 'FAIL: no debit note number allocated'; end if;
  if n_rows <> 1                    then raise exception 'FAIL: expected 1 debit note, got %', n_rows; end if;
  if c.taxable_value <> 2000        then raise exception 'FAIL: taxable should be 2000, got %', c.taxable_value; end if;
  if c.tax_amount <> 360            then raise exception 'FAIL: tax should be 360, got %', c.tax_amount; end if;
  if n_net <> 14160                 then raise exception 'FAIL: invoice net owed should rise to 14160, got %', n_net; end if;

  -- 3: export / zero-rated invoice → zero-rated debit note.
  r_exp := public.issue_debit_note('INV-DNT-EXP', 1000, 'additional_charge', null, null);
  select taxable_value, tax_amount into c_exp from public.debit_notes where invoice_id = 'INV-DNT-EXP' limit 1;
  if c_exp.taxable_value <> 1000 or c_exp.tax_amount <> 0 then
    raise exception 'FAIL: export debit note should be zero-rated (taxable 1000, tax 0), got taxable=% tax=%', c_exp.taxable_value, c_exp.tax_amount;
  end if;

  raise notice 'PASS: debit note split (2000+360) + net owed 11800→14160 (above invoice amount); export DN zero-rated';
end $$;

rollback;
