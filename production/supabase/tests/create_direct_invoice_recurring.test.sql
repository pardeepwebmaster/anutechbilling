-- Rolled-back test for the recurring option on create_direct_invoice (0159).
--
-- Proves the one-time / recurring choice drives whether a subscription is created
-- when the direct invoice is later paid:
--   RECURRING (p_recurring = true)  → quote.is_one_off = false → paying it creates
--                                     a yearly subscription.
--   ONE-TIME  (p_recurring = false) → quote.is_one_off = true  → paying it creates
--                                     NO subscription.
--
-- Runs as service_role inside a DO block that RAISES → full rollback.
--
-- Expected:
--   RECURRING: one_off=f subs_after_pay=1
--   ONE-TIME:  one_off=t subs_after_pay=0

do $$
declare
  v_cust uuid := '53db44e6-6e90-4fec-8871-8d2288393a2a';
  v_li jsonb := '[{"name":"Website AMC","qty":1,"rate":120000}]'::jsonb;   -- subtotal 120000, gross 141600 @18%
  r_rec record; r_one record;
  v_rec_subs int; v_one_subs int;
  v_rec_oneoff boolean; v_one_oneoff boolean;
  v_msg text := '';
begin
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform set_config('request.jwt.claim.role','service_role',true);
  update customers set country='India' where id=v_cust;

  select * into r_rec from create_direct_invoice(v_cust, v_li, 'rec', true);
  select is_one_off into v_rec_oneoff from quotes where id=r_rec.quote_id;
  perform record_payment(r_rec.quote_id, 141600, 'upi', 'REF-REC-1', null);
  select count(*) into v_rec_subs from subscriptions where quote_id=r_rec.quote_id;
  v_msg := v_msg || format('RECURRING: one_off=%s subs_after_pay=%s (expect f/1) | ', v_rec_oneoff, v_rec_subs);

  select * into r_one from create_direct_invoice(v_cust, v_li, 'one', false);
  select is_one_off into v_one_oneoff from quotes where id=r_one.quote_id;
  perform record_payment(r_one.quote_id, 141600, 'upi', 'REF-ONE-1', null);
  select count(*) into v_one_subs from subscriptions where quote_id=r_one.quote_id;
  v_msg := v_msg || format('ONE-TIME: one_off=%s subs_after_pay=%s (expect t/0)', v_one_oneoff, v_one_subs);

  raise exception 'TESTRESULT >> %', v_msg;
end $$;
