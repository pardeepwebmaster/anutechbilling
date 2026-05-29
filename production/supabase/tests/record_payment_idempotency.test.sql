-- Regression test: record_payment idempotency (migration 0051, audit bug #1/#2)
--
-- Run against a dev/test DB (NOT prod). Self-asserting: RAISEs on failure.
-- Everything runs inside a transaction that ROLLS BACK, so the DB stays clean.
--
--   psql "$DATABASE_URL" -f record_payment_idempotency.test.sql
--   -- or paste into the Supabase SQL editor
--
-- What it proves:
--   1. Same reference called twice  → exactly ONE payment row (idempotent).
--   2. Second call returns idempotent_replay = true.
--   3. Two DIFFERENT references      → BOTH record (genuine partial payments safe).

begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into public.tenants (id, name, email, state_code)
  values ('eeeeeeee-0000-0000-0000-00000000test'::uuid, 'IDEMPOTENCY TEST CO', 'idemp-test@example.in', '07');

insert into public.quotes (id, tenant_id, customer_name, amount, status, payment_status, line_items)
values
  ('Q-IDEMP-DUP',  'eeeeeeee-0000-0000-0000-00000000test'::uuid, 'Dup Test',  1000, 'sent', 'awaiting', '[]'::jsonb),
  ('Q-IDEMP-PART', 'eeeeeeee-0000-0000-0000-00000000test'::uuid, 'Part Test', 1000, 'sent', 'awaiting', '[]'::jsonb);

-- ── Test 1 + 2: duplicate reference is idempotent ────────────────────────────
do $$
declare
  r2          jsonb;
  n_payments  integer;
  total       integer;
begin
  perform public.record_payment('Q-IDEMP-DUP', 1000, 'razorpay', 'rzp_SAME_REF');
  r2 := public.record_payment('Q-IDEMP-DUP', 1000, 'razorpay', 'rzp_SAME_REF');  -- retry

  select count(*), coalesce(sum(amount), 0) into n_payments, total
    from public.payments where quote_id = 'Q-IDEMP-DUP';

  if n_payments <> 1 then
    raise exception 'FAIL idempotency: expected 1 payment row, got % (total %)', n_payments, total;
  end if;
  if total <> 1000 then
    raise exception 'FAIL idempotency: expected total 1000, got %', total;
  end if;
  if coalesce((r2->>'idempotent_replay')::boolean, false) is not true then
    raise exception 'FAIL: second call should return idempotent_replay=true, got %', r2->>'idempotent_replay';
  end if;
  raise notice 'PASS: duplicate reference -> 1 row, total 1000, replay flag set';
end $$;

-- ── Test 3: distinct references both record (partial payments stay safe) ──────
do $$
declare
  n_payments  integer;
  total       integer;
  pay_status  text;
begin
  perform public.record_payment('Q-IDEMP-PART', 500, 'cash', 'cash-ref-A');
  perform public.record_payment('Q-IDEMP-PART', 500, 'cash', 'cash-ref-B');

  select count(*), coalesce(sum(amount), 0) into n_payments, total
    from public.payments where quote_id = 'Q-IDEMP-PART';
  select payment_status into pay_status from public.quotes where id = 'Q-IDEMP-PART';

  if n_payments <> 2 then
    raise exception 'FAIL partial-payment: expected 2 rows, got %', n_payments;
  end if;
  if total <> 1000 then
    raise exception 'FAIL partial-payment: expected total 1000, got %', total;
  end if;
  if pay_status <> 'received' then
    raise exception 'FAIL partial-payment: expected quote received, got %', pay_status;
  end if;
  raise notice 'PASS: two distinct references -> 2 rows, total 1000, quote received';
end $$;

rollback;
