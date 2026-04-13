-- ================================================================
-- PocketMate — Add encrypted columns for sensitive financial values
-- Run in Supabase SQL Editor after 001 and 002.
--
-- Strategy: add *_enc text columns alongside existing numeric ones.
-- The vault API (src/app/api/vault/route.ts) auto-migrates existing
-- plaintext data on first read (encrypts → saves to _enc → zeros out
-- the old column). The app always reads from _enc going forward.
-- ================================================================

-- profiles — income, savings, savings target
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS income_enc  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS savings_enc text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_enc  text NOT NULL DEFAULT '';

-- cycle_state — wallet, cycle income, last cycle saved
ALTER TABLE cycle_state
  ADD COLUMN IF NOT EXISTS wallet_enc       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cycle_income_enc text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS saved_enc        text NOT NULL DEFAULT '';

-- monthly_savings — months array
ALTER TABLE monthly_savings
  ADD COLUMN IF NOT EXISTS months_enc text NOT NULL DEFAULT '';
