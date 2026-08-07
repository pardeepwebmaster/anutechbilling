-- 0170 — Add 'support' as a vendor type, so DSP support plans (Free/Basic/
-- Moderate/Premium) can be tracked in Billing's items catalog and, once a
-- customer buys one, as a subscription — same pattern as 'domain'/'hosting'
-- in migration 0169.

ALTER TYPE public.vendor ADD VALUE IF NOT EXISTS 'support';
