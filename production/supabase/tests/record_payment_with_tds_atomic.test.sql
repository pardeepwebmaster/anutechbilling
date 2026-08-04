-- Regression test: record_payment_with_tds atomicity (migration 0150, audit bug #22)
--
-- Run against a dev/test DB (NOT prod). Self-asserting: RAISEs on failure.
-- Everything runs inside a transaction that ROLLS BACK, so the DB stays clean.
--
--   psql "$DATABASE_URL" -f record_payment_with_tds_atomic.test.sql
--   -- or paste into the Supabase SQL editor
--
-- What it proves:
--   1. The payment and its TDS receivable are written in ONE transaction —
--      exactly one payment row and one tds_receivable row, the TDS row linked
--      to the payment via payment_id, with the amounts passed through verbatim.
--   2. Replaying the same reference does NOT create a second TDS row
--      (record_payment returns idempotent_replay, so the wrapper skips the TDS
--      insert). This is the property that #22 (best-effort client insert) lacked.

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into public.tenants (id, name, email, state_code)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'TDS ATOMIC TEST CO', 'tds-atomic@example.in', '07');

-- Priced quote, no line items (keeps the sub/PO branches out of the way); the
-- customer is created from the quote on first payment (migration 0078).
insert into public.quotes (id, tenant_id, customer_name, amount, subtotal, tax_rate, status, payment_status, line_items)
  values ('Q-TDS-ATOMIC', 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'TDS Cust', 10000, 8475, 18, 'sent', 'awaiting', '[]'::jsonb);

do $$
declare
  r1          jsonb;
  r2          jsonb;
  n_pay       integer;
  n_tds       integer;
  v_tds       record;
begin
  -- Customer deducts ₹1,000 TDS (section 194J): full ₹10,000 settled against the
  -- quote, ₹9,000 hits the bank, ₹1,000 tracked as a government receivable.
  r1 := public.record_payment_with_tds('Q-TDS-ATOMIC', 10000, 'bank_transfer', 'tds-ref-1', null,
          1000, 10000, 9000, '194J', 10, 'ABCD12345E', null, null);

  if coalesce((r1->>'tds_saved')::boolean, false) is not true then
    raise exception 'FAIL: first call did not save the TDS receivable (tds_saved=%)', r1->>'tds_saved';
  end if;

  -- Replay the SAME reference — must be idempotent and must NOT add a 2nd TDS row.
  r2 := public.record_payment_with_tds('Q-TDS-ATOMIC', 10000, 'bank_transfer', 'tds-ref-1', null,
          1000, 10000, 9000, '194J', 10, 'ABCD12345E', null, null);

  if coalesce((r2->>'tds_saved')::boolean, false) is not false then
    raise exception 'FAIL: replay created a second TDS receivable (tds_saved should be false)';
  end if;

  select count(*) into n_pay from public.payments       where quote_id = 'Q-TDS-ATOMIC';
  select count(*) into n_tds from public.tds_receivable where payment_id = nullif(r1->>'payment_id','')::uuid;

  if n_pay <> 1 then raise exception 'FAIL: expected 1 payment row, got %', n_pay; end if;
  if n_tds <> 1 then raise exception 'FAIL: expected 1 TDS receivable row, got %', n_tds; end if;

  select tds_amount, gross_amount, net_paid, section, payment_id
    into v_tds from public.tds_receivable where payment_id = nullif(r1->>'payment_id','')::uuid;

  if v_tds.tds_amount <> 1000 or v_tds.gross_amount <> 10000 or v_tds.net_paid <> 9000 then
    raise exception 'FAIL: TDS amounts wrong (tds=% gross=% net=%)', v_tds.tds_amount, v_tds.gross_amount, v_tds.net_paid;
  end if;
  if v_tds.section <> '194J' then raise exception 'FAIL: section wrong (%)', v_tds.section; end if;
  if v_tds.payment_id is distinct from nullif(r1->>'payment_id','')::uuid then
    raise exception 'FAIL: TDS row not linked to the payment';
  end if;

  raise notice 'PASS: payment + TDS committed atomically (1 pay, 1 tds, linked, amounts verbatim); replay added no duplicate TDS';
end $$;

rollback;
