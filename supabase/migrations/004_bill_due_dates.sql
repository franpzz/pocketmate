-- ================================================================
-- PocketMate — Bill due dates
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ================================================================

ALTER TABLE fixed_expenses
  ADD COLUMN IF NOT EXISTS due_day       integer CHECK (due_day BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS last_paid_date date;
