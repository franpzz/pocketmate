'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Profile,
  CycleState,
  FixedExpense,
  Transaction,
  MonthlySavings,
  CustomCategory,
} from '@/lib/types'

interface AppState {
  profile: Profile | null
  cycleState: CycleState | null
  fixedExpenses: FixedExpense[]
  transactions: Transaction[]
  monthlySavings: MonthlySavings | null
  customCats: CustomCategory[]
  loading: boolean
  refetch: () => Promise<void>
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cycleState, setCycleState] = useState<CycleState | null>(null)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [monthlySavings, setMonthlySavings] = useState<MonthlySavings | null>(null)
  const [customCats, setCustomCats] = useState<CustomCategory[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [
      { data: profileData },
      { data: cycleData },
      { data: fixedData },
      { data: txnsData },
      { data: savingsData },
      { data: catsData },
    ] = await Promise.all([
      supabase.from('profiles').select('*').single(),
      supabase.from('cycle_state').select('*').single(),
      supabase.from('fixed_expenses').select('*').order('sort_order'),
      supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('monthly_savings').select('*').eq('year', new Date().getFullYear()).single(),
      supabase.from('custom_categories').select('*').order('sort_order'),
    ])

    setProfile(profileData ?? null)
    setCycleState(cycleData ?? null)
    setFixedExpenses(fixedData ?? [])
    setTransactions(txnsData ?? [])
    setMonthlySavings(savingsData ?? null)
    setCustomCats(catsData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <AppStateContext.Provider value={{
      profile,
      cycleState,
      fixedExpenses,
      transactions,
      monthlySavings,
      customCats,
      loading,
      refetch: fetchAll,
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
