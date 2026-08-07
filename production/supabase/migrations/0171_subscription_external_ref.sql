-- 0171 — external_ref on subscriptions: holds whatever identifier the
-- OWNING system (not Billing) needs to actually execute an action on this
-- subscription. For vendor='hosting' this is the DirectAdmin username —
-- without it, Billing can decide a hosting account should be suspended but
-- has no way to tell Customer Panel WHICH account to act on.

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS external_ref text;
