-- Regression test: issue_credit_note (migration 0154, CGST §34).
--
-- Run against a dev/test DB (NOT prod). Self-asserting: RAISEs on failure.
-- Everything runs inside a transaction that ROLLS BACK, so the DB stays clean.
--
-- What it proves:
--   1. A credit note against a domestic invoice freezes the correct GST split
--      (mirrors the invoice's rate: gross → taxable + tax) and gets a CN number.
--   2. It lowers the invoice's net owed (frozen amount/taxable/tax untouched).
--   3. You cannot credit MORE than the invoice's creditable balance (guard).
--   4. An export / zero-rated invoice (rate 0) yields a zero-rated credit note.

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, name, email, state_code)
  values ('cccccccc-0000-0000-0000-0000000c00a1'::uuid, 'CREDIT NOTE TEST', 'cn-test@example.in', '07');

-- Domestic invoice: ₹11,800 gross (₹10,000 + 18%).
insert into public.invoices (id, tenant_id, customer_name, amount, status, invoice_date, net_payable, taxable_value, tax_amount, tax_rate, inter_state)
  values ('INV-CNT-DOM', 'cccccccc-0000-0000-0000-0000000c00a1'::uuid, 'Dom Cust', 11800, 'pending', current_date, 11800, 10000, 1800, 18, false);

-- Export invoice: zero-rated (rate 0), ₹5,000.
insert into public.invoices (id, tenant_id, customer_name, amount, status, invoice_date, net_payable, taxable_value, tax_amount, tax_rate, inter_state)
  values ('INV-CNT-EXP', 'cccccccc-0000-0000-0000-0000000c00a1'::uuid, 'Exp Cust', 5000, 'pending', current_date, 5000, 5000, 0, 0, false);

do $$
declare
  r1 jsonb; c record; n_net integer; n_rows integer;
  v_over boolean := false;
  r_exp jsonb; c_exp record;
begin
  -- 1 + 2: partial ₹5,900 credit (2 seats reduced) on the domestic invoice.
  r1 := public.issue_credit_note('INV-CNT-DOM', 5900, 'seats_reduced', 'reduced 2 seats', null);

  select amount, taxable_value, tax_amount, tax_rate, inter_state into c
    from public.credit_notes where invoice_id = 'INV-CNT-DOM' limit 1;
  select count(*) into n_rows from public.credit_notes where invoice_id = 'INV-CNT-DOM';
  select net_payable into n_net from public.invoices where id = 'INV-CNT-DOM';

  if (r1->>'credit_note_id') is null       then raise exception 'FAIL: no credit note number allocated'; end if;
  if n_rows <> 1                            then raise exception 'FAIL: expected 1 credit note, got %', n_rows; end if;
  if c.taxable_value <> 5000                then raise exception 'FAIL: taxable should be 5000, got %', c.taxable_value; end if;
  if c.tax_amount <> 900                    then raise exception 'FAIL: tax should be 900, got %', c.tax_amount; end if;
  if c.inter_state is not false             then raise exception 'FAIL: inter_state should mirror the invoice (false)'; end if;
  if n_net <> 5900                          then raise exception 'FAIL: invoice net owed should drop to 5900, got %', n_net; end if;

  -- 3: over-credit guard — ₹6,000 > remaining ₹5,900 must be rejected.
  begin
    perform public.issue_credit_note('INV-CNT-DOM', 6000, 'other', null, null);
  exception when others then v_over := true;
  end;
  if not v_over then raise exception 'FAIL: over-credit beyond the invoice value was NOT rejected'; end if;

  -- 4: export / zero-rated invoice → zero-rated credit note.
  r_exp := public.issue_credit_note('INV-CNT-EXP', 5000, 'cancellation', 'export cancel', null);
  select taxable_value, tax_amount into c_exp from public.credit_notes where invoice_id = 'INV-CNT-EXP' limit 1;
  if c_exp.taxable_value <> 5000 or c_exp.tax_amount <> 0 then
    raise exception 'FAIL: export credit note should be zero-rated (taxable 5000, tax 0), got taxable=% tax=%', c_exp.taxable_value, c_exp.tax_amount;
  end if;

  raise notice 'PASS: domestic CN split (5000+900) + net owed 11800→5900; over-credit rejected; export CN zero-rated';
end $$;

rollback;
