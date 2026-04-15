export type Cadence = 'weekly' | 'fortnightly' | 'monthly'

export interface Profile {
  id: string
  user_id: string
  name: string
  income: number
  cadence: Cadence
  extra: number
  groceries: number
  dining: number
  transport: number
  entertainment: number
  monthly_target: number
  goal_name: string
  total_savings: number
  created_at: string
  updated_at: string
}

export interface CycleState {
  id: string
  user_id: string
  wallet: number
  cycle_income: number
  has_first_pay: boolean
  last_paid_date: string | null
  last_cycle_saved: number | null
  cycle_spending: Record<string, number>   // { "Groceries": 45.50, ... }
  updated_at: string
}

export interface FixedExpense {
  id: string
  user_id: string
  name: string
  amount: number
  cat: string
  split: number
  paid_this_cycle: boolean
  due_day: number | null        // 1–28, null = reset on "I got paid" (old behaviour)
  last_paid_date: string | null // ISO date of last payment, used with due_day
  sort_order: number
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  icon: string
  bg: string
  name: string
  cat: string
  amount: number       // always positive
  is_positive: boolean
  date: string         // ISO date string, e.g. "2026-04-12"
  created_at: string
}

export interface MonthlySavings {
  id: string
  user_id: string
  year: number
  months: number[]     // [Jan, Feb, ..., Dec] — 12 elements
}

export interface CustomCategory {
  id: string
  user_id: string
  name: string
  icon: string
  sort_order: number
  created_at: string
}
