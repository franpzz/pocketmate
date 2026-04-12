-- ================================================================
-- PocketMate — Initial Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ================================================================

-- profiles — user financial settings
CREATE TABLE IF NOT EXISTS profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name             text        NOT NULL DEFAULT '',
  income           numeric     NOT NULL DEFAULT 0,
  cadence          text        NOT NULL DEFAULT 'weekly',   -- 'weekly' | 'fortnightly' | 'monthly'
  extra            numeric     NOT NULL DEFAULT 0,
  groceries        numeric     NOT NULL DEFAULT 120,        -- weekly $
  dining           numeric     NOT NULL DEFAULT 80,         -- weekly $
  transport        numeric     NOT NULL DEFAULT 80,         -- weekly $
  entertainment    numeric     NOT NULL DEFAULT 20,         -- weekly $
  monthly_target   numeric     NOT NULL DEFAULT 500,
  goal_name        text        NOT NULL DEFAULT 'Savings goal',
  total_savings    numeric     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- cycle_state — live wallet & current pay cycle
CREATE TABLE IF NOT EXISTS cycle_state (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet           numeric     NOT NULL DEFAULT 0,
  cycle_income     numeric     NOT NULL DEFAULT 0,
  has_first_pay    boolean     NOT NULL DEFAULT false,
  last_paid_date   timestamptz,
  last_cycle_saved numeric,
  cycle_spending   jsonb       NOT NULL DEFAULT '{}',       -- { "Groceries": 45.50, ... }
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- fixed_expenses — recurring bills
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name             text        NOT NULL DEFAULT '',
  amount           numeric     NOT NULL DEFAULT 0,
  cat              text        NOT NULL DEFAULT 'Other',
  split            integer     NOT NULL DEFAULT 1,
  paid_this_cycle  boolean     NOT NULL DEFAULT false,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- transactions — full history
CREATE TABLE IF NOT EXISTS transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  icon         text    NOT NULL DEFAULT '📦',
  bg           text    NOT NULL DEFAULT '',
  name         text    NOT NULL DEFAULT '',
  cat          text    NOT NULL DEFAULT 'Other',
  amount       numeric NOT NULL,                  -- always positive
  is_positive  boolean NOT NULL DEFAULT false,
  date         date    NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- monthly_savings — locked-in savings per calendar year
CREATE TABLE IF NOT EXISTS monthly_savings (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  year     integer NOT NULL,
  months   jsonb   NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0]',  -- Jan–Dec
  UNIQUE(user_id, year)
);

-- custom_categories — user-defined spending categories
CREATE TABLE IF NOT EXISTS custom_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text        NOT NULL,
  icon       text        NOT NULL DEFAULT '🏷',
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- ================================================================
-- Row Level Security — users can only read/write their own rows
-- ================================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_savings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows only" ON profiles
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own rows only" ON cycle_state
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own rows only" ON fixed_expenses
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own rows only" ON transactions
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own rows only" ON monthly_savings
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own rows only" ON custom_categories
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
