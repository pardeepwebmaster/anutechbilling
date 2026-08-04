-- Rolled-back test for the referral-commission auto-accrual trigger (migration 0156).
--
-- Proves:
--   T1  one_time percent + TDS on a DOMESTIC deal → ex-GST base + 5% TDS split correct,
--       and a SECOND payment on the same customer does NOT double-accrue (one_time guard).
--   T2  recurring percent on an EXPORT deal (tax_rate 0) → base = full amount (no GST),
--       no TDS, and EVERY payment accrues (2 payments → 2 commissions).
--   T3  a refunded payment must NOT accrue.
--
-- Pattern: everything runs inside one DO block that RAISES at the end, so the whole
-- transaction rolls back — nothing is persisted. Read the result from the raised
-- 'TESTRESULT >> ...' message. Swap the tenant/customer UUIDs for your own before running.
--
-- Expected (all must match):
--   T1 first: base=10000 gross=1000 tds=50 net=950
--   T1 one_time count after 2nd pay=1
--   T2 recurring count=2; base=5000 gross=500 tds=0 net=500
--   T3 count after refund pay=2  (unchanged)

do $$
declare
  v_tenant  uuid := 'fbb976f1-9090-4f10-9726-0901bd144e42';  -- Anutech Digital
  v_cust    uuid := '53db44e6-6e90-4fec-8871-8d2288393a2a';
  v_partner uuid;
  v_agr1    uuid;
  v_agr2    uuid;
  v_msg     text := '';
  r         record;
  v_cnt     int;
begin
  insert into referral_partners(tenant_id, name, deduct_tds, tds_rate)
    values (v_tenant, 'TEST Partner', true, 5) returning id into v_partner;

  -- T1: one_time percent 10 + TDS 5, domestic (tax_rate 18). Gross 11800 → ex-GST 10000.
  insert into referral_agreements(tenant_id, partner_id, customer_id, basis, percent, scope, deduct_tds, tds_rate, status)
    values (v_tenant, v_partner, v_cust, 'percent', 10, 'one_time', true, 5, 'active') returning id into v_agr1;
  insert into quotes(id, tenant_id, customer_name, customer_id, tax_rate, amount)
    values ('TESTQ-DOM-1', v_tenant, 'TEST', v_cust, 18, 11800);
  insert into payments(id, tenant_id, quote_id, customer_id, amount, method, status, received_at, created_at)
    values (gen_random_uuid(), v_tenant, 'TESTQ-DOM-1', v_cust, 11800, 'upi', 'received', now(), now());
  select base_amount, gross_commission, tds_amount, net_payable into r
    from referral_commissions where agreement_id = v_agr1;
  v_msg := v_msg || format('T1 first: base=%s gross=%s tds=%s net=%s (expect 10000/1000/50/950) | ',
                           r.base_amount, r.gross_commission, r.tds_amount, r.net_payable);

  insert into quotes(id, tenant_id, customer_name, customer_id, tax_rate, amount)
    values ('TESTQ-DOM-2', v_tenant, 'TEST', v_cust, 18, 11800);
  insert into payments(id, tenant_id, quote_id, customer_id, amount, method, status, received_at, created_at)
    values (gen_random_uuid(), v_tenant, 'TESTQ-DOM-2', v_cust, 11800, 'upi', 'received', now(), now());
  select count(*) into v_cnt from referral_commissions where agreement_id = v_agr1;
  v_msg := v_msg || format('T1 one_time count after 2nd pay=%s (expect 1) | ', v_cnt);

  update referral_agreements set status='closed' where id = v_agr1;

  -- T2: recurring percent 10, export (tax_rate 0), no TDS. base = full amount, per payment.
  insert into referral_agreements(tenant_id, partner_id, customer_id, basis, percent, scope, deduct_tds, status)
    values (v_tenant, v_partner, v_cust, 'percent', 10, 'recurring', false, 'active') returning id into v_agr2;
  insert into quotes(id, tenant_id, customer_name, customer_id, tax_rate, amount)
    values ('TESTQ-EXP-1', v_tenant, 'TEST', v_cust, 0, 5000);
  insert into payments(id, tenant_id, quote_id, customer_id, amount, method, status, received_at, created_at)
    values (gen_random_uuid(), v_tenant, 'TESTQ-EXP-1', v_cust, 5000, 'upi', 'received', now(), now());
  insert into quotes(id, tenant_id, customer_name, customer_id, tax_rate, amount)
    values ('TESTQ-EXP-2', v_tenant, 'TEST', v_cust, 0, 5000);
  insert into payments(id, tenant_id, quote_id, customer_id, amount, method, status, received_at, created_at)
    values (gen_random_uuid(), v_tenant, 'TESTQ-EXP-2', v_cust, 5000, 'upi', 'received', now(), now());
  select count(*) into v_cnt from referral_commissions where agreement_id = v_agr2;
  select base_amount, gross_commission, tds_amount, net_payable into r
    from referral_commissions where agreement_id = v_agr2 limit 1;
  v_msg := v_msg || format('T2 recurring count=%s (expect 2); base=%s gross=%s tds=%s net=%s (expect 5000/500/0/500) | ',
                           v_cnt, r.base_amount, r.gross_commission, r.tds_amount, r.net_payable);

  -- T3: refunded payment must NOT accrue.
  insert into quotes(id, tenant_id, customer_name, customer_id, tax_rate, amount)
    values ('TESTQ-REF-1', v_tenant, 'TEST', v_cust, 18, 11800);
  insert into payments(id, tenant_id, quote_id, customer_id, amount, method, status, received_at, refunded_at, created_at)
    values (gen_random_uuid(), v_tenant, 'TESTQ-REF-1', v_cust, 11800, 'upi', 'received', now(), now(), now());
  select count(*) into v_cnt from referral_commissions where agreement_id = v_agr2;
  v_msg := v_msg || format('T3 count after refund pay=%s (expect still 2)', v_cnt);

  raise exception 'TESTRESULT >> %', v_msg;
end $$;
