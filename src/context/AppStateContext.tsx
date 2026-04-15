'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readVault } from '@/lib/vault'
import type {
  Profile,
  CycleState,
  FixedExpense,
  Transaction,
  MonthlySavings,
  CustomCategory,
  SavingsGoal,
  Cadence,
} from '@/lib/types'

// ── Guest data shape ───────────────────────────────────────────────────────────

export interface GuestData {
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
  wallet: number
  cycle_income: number
  has_first_pay: boolean
  last_paid_date: string | null
  last_cycle_saved: number | null
  cycle_spending: Record<string, number>
  months: number[]
  fixed: FixedExpense[]
  transactions: Transaction[]
  customCats: CustomCategory[]
  goals: SavingsGoal[]
}

const DEFAULT_GUEST: GuestData = {
  name: 'Guest',
  income: 2000,
  cadence: 'weekly',
  extra: 0,
  groceries: 120,
  dining: 80,
  transport: 80,
  entertainment: 20,
  monthly_target: 500,
  goal_name: 'Savings goal',
  total_savings: 0,
  wallet: 0,
  cycle_income: 0,
  has_first_pay: false,
  last_paid_date: null,
  last_cycle_saved: null,
  cycle_spending: {},
  months: new Array(12).fill(0),
  fixed: [],
  transactions: [],
  customCats: [],
  goals: [],
}

function loadGuest(): GuestData {
  try {
    const raw = localStorage.getItem('pm_guest_data')
    if (raw) return { ...DEFAULT_GUEST, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_GUEST }
}

function saveGuest(data: GuestData) {
  localStorage.setItem('pm_guest_data', JSON.stringify(data))
}

function isGuestCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim() === 'pm_guest=1')
}

function guestToProfile(g: GuestData): Profile {
  return {
    id: 'guest',
    user_id: 'guest',
    name: g.name,
    income: g.income,
    cadence: g.cadence,
    extra: g.extra,
    groceries: g.groceries,
    dining: g.dining,
    transport: g.transport,
    entertainment: g.entertainment,
    monthly_target: g.monthly_target,
    goal_name: g.goal_name,
    total_savings: g.total_savings,
    created_at: '',
    updated_at: '',
  }
}

function guestToCycleState(g: GuestData): CycleState {
  return {
    id: 'guest',
    user_id: 'guest',
    wallet: g.wallet,
    cycle_income: g.cycle_income,
    has_first_pay: g.has_first_pay,
    last_paid_date: g.last_paid_date,
    last_cycle_saved: g.last_cycle_saved,
    cycle_spending: g.cycle_spending,
    updated_at: '',
  }
}

function guestToMonthlySavings(g: GuestData): MonthlySavings {
  return {
    id: 'guest',
    user_id: 'guest',
    year: new Date().getFullYear(),
    months: g.months,
  }
}

// ── Context type ───────────────────────────────────────────────────────────────

interface AppState {
  profile: Profile | null
  cycleState: CycleState | null
  fixedExpenses: FixedExpense[]
  transactions: Transaction[]
  monthlySavings: MonthlySavings | null
  customCats: CustomCategory[]
  savingsGoals: SavingsGoal[]
  loading: boolean
  isGuest: boolean
  refetch: () => Promise<void>
  guestUpdate: (updates: Partial<GuestData>) => void
}

const AppStateContext = createContext<AppState | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────────

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [profile,        setProfile]        = useState<Profile | null>(null)
  const [cycleState,     setCycleState]     = useState<CycleState | null>(null)
  const [fixedExpenses,  setFixedExpenses]  = useState<FixedExpense[]>([])
  const [transactions,   setTransactions]   = useState<Transaction[]>([])
  const [monthlySavings, setMonthlySavings] = useState<MonthlySavings | null>(null)
  const [customCats,     setCustomCats]     = useState<CustomCategory[]>([])
  const [savingsGoals,   setSavingsGoals]   = useState<SavingsGoal[]>([])
  const [loading,        setLoading]        = useState(true)
  const [isGuest,        setIsGuest]        = useState(false)

  const fetchAll = useCallback(async () => {
    // Note: loading starts as true (useState), we only ever set it to false.
    // Subsequent refetch() calls from save() run silently without blanking the UI.

    // ── Guest mode ────────────────────────────────────────────────────────────
    if (isGuestCookie()) {
      setIsGuest(true)
      const g = loadGuest()
      setProfile(guestToProfile(g))
      setCycleState(guestToCycleState(g))
      setFixedExpenses(g.fixed)
      setTransactions(g.transactions)
      setMonthlySavings(guestToMonthlySavings(g))
      setCustomCats(g.customCats)
      setSavingsGoals(g.goals)
      setLoading(false)
      return
    }

    // ── Authenticated mode ────────────────────────────────────────────────────
    setIsGuest(false)
    const supabase = createClient()

    try {
      const [
        { data: profileData },
        { data: cycleData },
        { data: fixedData },
        { data: txnsData },
        { data: savingsData },
        { data: catsData },
        { data: goalsData },
        vault,
      ] = await Promise.all([
        supabase.from('profiles').select('*').single(),
        supabase.from('cycle_state').select('*').single(),
        supabase.from('fixed_expenses').select('*').order('sort_order'),
        supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('monthly_savings').select('*').eq('year', new Date().getFullYear()).single(),
        supabase.from('custom_categories').select('*').order('sort_order'),
        supabase.from('savings_goals').select('*').order('sort_order'),
        readVault(),
      ])

      // Overlay vault (encrypted) values onto Supabase data
      setProfile(profileData ? {
        ...profileData,
        income:         vault.income,
        total_savings:  vault.total_savings,
        monthly_target: vault.monthly_target,
      } : null)

      setCycleState(cycleData ? {
        ...cycleData,
        wallet:           vault.wallet,
        cycle_income:     vault.cycle_income,
        last_cycle_saved: vault.last_cycle_saved,
      } : null)

      setMonthlySavings(savingsData ? {
        ...savingsData,
        months: vault.months,
      } : savingsData ?? null)

      setFixedExpenses(fixedData   ?? [])
      setTransactions(txnsData     ?? [])
      setCustomCats(catsData       ?? [])
      setSavingsGoals(goalsData    ?? [])
    } catch (err) {
      console.error('fetchAll error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Guest update helper ───────────────────────────────────────────────────────
  const guestUpdate = useCallback((updates: Partial<GuestData>) => {
    const current = loadGuest()
    const next = { ...current, ...updates }
    saveGuest(next)
    // Apply immediately without a full async refetch
    setProfile(guestToProfile(next))
    setCycleState(guestToCycleState(next))
    setFixedExpenses(next.fixed)
    setTransactions(next.transactions)
    setMonthlySavings(guestToMonthlySavings(next))
    setCustomCats(next.customCats)
    setSavingsGoals(next.goals)
  }, [])

  return (
    <AppStateContext.Provider value={{
      profile,
      cycleState,
      fixedExpenses,
      transactions,
      monthlySavings,
      customCats,
      savingsGoals,
      loading,
      isGuest,
      refetch: fetchAll,
      guestUpdate,
    }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider')
  return ctx
}
