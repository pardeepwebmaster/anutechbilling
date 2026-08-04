-- Regression test: deleting an invoice must NOT reuse its GST serial (MONEY-3, migration 0118).
-- Self-asserting; rolled back:  psql "$DATABASE_URL" -f invoice_delete_no_serial_reuse.test.sql
--
-- Proves the document-series counter is NOT rolled back on delete, so the next
-- invoice takes a FRESH number (a deleted number is retired, never reissued —
-- CGST Rule 46 forbids two supplies sharing one invoice number).

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.tenants (id, name, email, state_code, doc_code)
  values ('aaaa4444-0000-0000-0000-000000000004','DEL TEST','d@example.in','07','DELT');
insert into public.customers (id, tenant_id, name, state_code)
  values ('bbbb4444-0000-0000-0000-000000000004','aaaa4444-0000-0000-0000-000000000004','Cust Del','07');
insert into public.document_series (tenant_id, doc_type, fiscal_year, prefix, last_number)
  values ('aaaa4444-0000-0000-0000-000000000004','invoice', public.indian_fiscal_year(current_date), 'INV', 5);
insert into public.quotes (id, tenant_id, customer_id, customer_name, amount, subtotal, tax_rate, status, payment_status, line_items)
  values ('Q-DEL-TEST','aaaa4444-0000-0000-0000-000000000004','bbbb4444-0000-0000-0000-000000000004','Cust Del',
          118000, 100000, 18, 'sent', 'awaiting', '[]'::jsonb);
do $$
declare v_inv text; v_after_gen int; v_after_del int; v_next text;
begin
  select invoice_id into v_inv from public.generate_invoice('Q-DEL-TEST');
  select last_number into v_after_gen from public.document_series
   where tenant_id='aaaa4444-0000-0000-0000-000000000004' and doc_type='invoice';
  perform public.delete_subscription_invoice(v_inv);
  select last_number into v_after_del from public.document_series
   where tenant_id='aaaa4444-0000-0000-0000-000000000004' and doc_type='invoice';
  if v_after_gen <> 6 then raise exception 'FAIL: series after gen expected 6, got %', v_after_gen; end if;
  if v_after_del <> 6 then raise exception 'FAIL: series ROLLED BACK to % — serial-reuse bug present', v_after_del; end if;
  update public.quotes set invoice_id=null, payment_status='awaiting' where id='Q-DEL-TEST';
  select invoice_id into v_next from public.generate_invoice('Q-DEL-TEST');
  if v_next not like '%0007' then raise exception 'FAIL: next invoice reused a number: %', v_next; end if;
  raise notice 'PASS: deleted %, series stayed 6, next = % (no reuse)', v_inv, v_next;
end $$;
rollback;
