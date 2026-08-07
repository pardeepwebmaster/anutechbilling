-- 0169 — Add 'domain' and 'hosting' as vendor types, so Customer Panel's
-- domain/hosting sales can be tracked as subscriptions here (renewal_date,
-- auto_renew, etc.) using the exact same cron/cadence machinery already
-- built for Workspace/M365 subscriptions — no new columns needed.
--
-- Additive only: existing rows/logic untouched. Not run inside a
-- transaction block with code that uses the new values in the same
-- migration (Postgres requirement for ALTER TYPE ... ADD VALUE).

ALTER TYPE public.vendor ADD VALUE IF NOT EXISTS 'domain';
ALTER TYPE public.vendor ADD VALUE IF NOT EXISTS 'hosting';
