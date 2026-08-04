-- Rolled-back test: generate_invoice (migration 0163) sets the invoice DUE DATE
-- from the quote's payment_terms_days (Net 15 / 30 / 45), falling back to net-30
-- when the term is null. Runs as service_role in a DO block that RAISES → rollback.
--
-- Expected: NET15 due = today+15 ; NULL due = today+30.

do $$
declare
  v_tenant uuid := 'fbb976f1-9090-4f10-9726-0901bd144e42';  -- Anutech Digital
  v_cust   uuid := '53db44e6-6e90-4fec-8871-8d2288393a2a';
  v_due15 date; v_due_default date;
  v_msg text := '';
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  insert into quotes(id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, line_items, status, payment_status, payment_terms_days)
    values('TESTQ-PT15', v_tenant, v_cust, 'TEST', 11800, 10000, 18, '[]'::jsonb, 'sent', 'awaiting', 15);
  perform generate_invoice('TESTQ-PT15');
  select due_date into v_due15 from invoices where quote_id='TESTQ-PT15';

  insert into quotes(id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, line_items, status, payment_status, payment_terms_days)
    values('TESTQ-PTNULL', v_tenant, v_cust, 'TEST', 11800, 10000, 18, '[]'::jsonb, 'sent', 'awaiting', null);
  perform generate_invoice('TESTQ-PTNULL');
  select due_date into v_due_default from invoices where quote_id='TESTQ-PTNULL';

  v_msg := format('NET15 due=%s (expect %s) | NULL due=%s (expect %s)',
                  v_due15, current_date+15, v_due_default, current_date+30);
  raise exception 'TESTRESULT >> %', v_msg;
end $$;
