-- Migration 005: Savings goals table

CREATE TABLE IF NOT EXISTS savings_goals (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  saved_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  icon         TEXT         NOT NULL DEFAULT '🎯',
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own savings goals"
  ON savings_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
