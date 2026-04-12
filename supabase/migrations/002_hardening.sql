-- ================================================================
-- PocketMate — Hardening: trigger + row limits
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Auto-create user rows on signup
--
-- When email confirmation is ON, the client has no session at signup
-- time, so RLS blocks all inserts. This trigger fires on auth.users
-- INSERT (before the confirmation email is even sent) and creates
-- the profile/cycle_state/monthly_savings rows using SECURITY DEFINER
-- (bypasses RLS). Onboarding data is passed via signUp options.data
-- and lands in raw_user_meta_data.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, name, income, cadence, extra,
    groceries, dining, transport, entertainment,
    monthly_target, goal_name, total_savings
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name',           'User'),
    COALESCE((NEW.raw_user_meta_data->>'income')::numeric,          0),
    COALESCE(NEW.raw_user_meta_data->>'cadence',        'weekly'),
    0,
    COALESCE((NEW.raw_user_meta_data->>'groceries')::numeric,       120),
    COALESCE((NEW.raw_user_meta_data->>'dining')::numeric,          80),
    COALESCE((NEW.raw_user_meta_data->>'transport')::numeric,       80),
    COALESCE((NEW.raw_user_meta_data->>'entertainment')::numeric,   20),
    COALESCE((NEW.raw_user_meta_data->>'monthly_target')::numeric,  500),
    COALESCE(NEW.raw_user_meta_data->>'goal_name',      'Savings goal'),
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.cycle_state (user_id, wallet, cycle_income, has_first_pay, cycle_spending)
  VALUES (NEW.id, 0, 0, false, '{}')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.monthly_savings (user_id, year, months)
  VALUES (NEW.id, EXTRACT(YEAR FROM NOW())::int, '[0,0,0,0,0,0,0,0,0,0,0,0]')
  ON CONFLICT (user_id, year) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists so this script is re-runnable
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------
-- 2. Row count limits — prevent unlimited writes from a valid account
-- ----------------------------------------------------------------

-- Max 1 000 transactions per user
CREATE OR REPLACE FUNCTION check_transaction_limit()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.transactions WHERE user_id = NEW.user_id) >= 1000 THEN
    RAISE EXCEPTION 'Transaction limit reached (max 1 000 per account)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS limit_transactions ON public.transactions;
CREATE TRIGGER limit_transactions
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION check_transaction_limit();


-- Max 50 fixed expenses per user
CREATE OR REPLACE FUNCTION check_fixed_expense_limit()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.fixed_expenses WHERE user_id = NEW.user_id) >= 50 THEN
    RAISE EXCEPTION 'Fixed expense limit reached (max 50 per account)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS limit_fixed_expenses ON public.fixed_expenses;
CREATE TRIGGER limit_fixed_expenses
  BEFORE INSERT ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION check_fixed_expense_limit();


-- Max 20 custom categories per user
CREATE OR REPLACE FUNCTION check_custom_cat_limit()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.custom_categories WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'Custom category limit reached (max 20 per account)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS limit_custom_cats ON public.custom_categories;
CREATE TRIGGER limit_custom_cats
  BEFORE INSERT ON public.custom_categories
  FOR EACH ROW EXECUTE FUNCTION check_custom_cat_limit();
