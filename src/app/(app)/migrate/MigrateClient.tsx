'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import s from './migrate.module.css'

interface LedgeFixed {
  name: string
  amount: number
  cat: string
  split: number
  paidThisCycle: boolean
}

interface LedgeTxn {
  icon: string
  bg: string
  name: string
  cat: string
  amt: string   // e.g. "+$45.00" or "-$1,234.56"
  pos: boolean
  date: string  // e.g. "11 Apr"
}

interface LedgeData {
  name: string
  income: number
  cadence: 'weekly' | 'fortnightly' | 'monthly'
  extra: number
  fixed: LedgeFixed[]
  groceries: number
  dining: number
  transport: number
  entertainment: number
  monthlyTarget: number
  goalName: string
  monthlySaved: number[]
  savedYear: number
  lastPaidDate: string | null
  transactions: LedgeTxn[]
  wallet: number
  cycleIncome: number
  hasFirstPay: boolean
  lastCycleSaved: number | null
  totalSavings: number
  customCats: Array<{ name: string; icon: string }>
  cycleSpending: Record<string, number>
  storeVersion: number
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4,  Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function parseAmt(amtStr: string): number {
  return parseFloat(amtStr.replace(/[^0-9.]/g, '')) || 0
}

function parseTxnDate(dateStr: string): string {
  const m = dateStr.match(/^(\d+)\s+(\w+)$/)
  if (!m) return new Date().toISOString().split('T')[0]
  const day = parseInt(m[1])
  const month = MONTH_MAP[m[2]]
  if (month === undefined) return new Date().toISOString().split('T')[0]
  const now = new Date()
  // Try current year; if that puts the date in the future, use last year
  let d = new Date(now.getFullYear(), month, day)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d > tomorrow) d = new Date(now.getFullYear() - 1, month, day)
  return d.toISOString().split('T')[0]
}

type Status = 'idle' | 'running' | 'done' | 'error'

export default function MigrateClient() {
  const router = useRouter()
  const [data,     setData]     = useState<LedgeData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [status,   setStatus]   = useState<Status>('idle')
  const [errMsg,   setErrMsg]   = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ledge_v1')
      if (!raw) { setNotFound(true); return }
      setData(JSON.parse(raw))
    } catch {
      setNotFound(true)
    }
  }, [])

  async function runMigration() {
    if (!data) return
    setStatus('running')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const uid = user.id
      const cy  = new Date().getFullYear()
      const now = new Date().toISOString()

      // 1. Profile
      await supabase.from('profiles').update({
        name:           data.name,
        income:         data.income,
        cadence:        data.cadence,
        extra:          data.extra,
        groceries:      data.groceries,
        dining:         data.dining,
        transport:      data.transport,
        entertainment:  data.entertainment,
        monthly_target: data.monthlyTarget,
        goal_name:      data.goalName,
        total_savings:  data.totalSavings,
        updated_at:     now,
      }).eq('user_id', uid)

      // 2. Cycle state
      await supabase.from('cycle_state').update({
        wallet:          data.wallet,
        cycle_income:    data.cycleIncome,
        has_first_pay:   data.hasFirstPay,
        last_paid_date:  data.lastPaidDate || null,
        last_cycle_saved: data.lastCycleSaved ?? null,
        cycle_spending:  data.cycleSpending,
        updated_at:      now,
      }).eq('user_id', uid)

      // 3. Fixed expenses — replace
      await supabase.from('fixed_expenses').delete().eq('user_id', uid)
      if (data.fixed.length > 0) {
        await supabase.from('fixed_expenses').insert(
          data.fixed.map((e, i) => ({
            user_id:         uid,
            name:            e.name,
            amount:          e.amount,
            cat:             e.cat,
            split:           e.split || 1,
            paid_this_cycle: e.paidThisCycle,
            sort_order:      i,
          }))
        )
      }

      // 4. Transactions — replace
      await supabase.from('transactions').delete().eq('user_id', uid)
      if (data.transactions.length > 0) {
        // Insert in chunks of 500 to stay within Supabase limits
        const rows = data.transactions.map(t => ({
          user_id:     uid,
          icon:        t.icon,
          bg:          t.bg,
          name:        t.name,
          cat:         t.cat,
          amount:      parseAmt(t.amt),
          is_positive: t.pos,
          date:        parseTxnDate(t.date),
        }))
        for (let i = 0; i < rows.length; i += 500) {
          await supabase.from('transactions').insert(rows.slice(i, i + 500))
        }
      }

      // 5. Monthly savings for current year
      const monthlySaved = data.savedYear === cy ? (data.monthlySaved || new Array(12).fill(0)) : new Array(12).fill(0)
      const { data: existing } = await supabase
        .from('monthly_savings')
        .select('id')
        .eq('user_id', uid)
        .eq('year', cy)
        .maybeSingle()
      if (existing) {
        await supabase.from('monthly_savings').update({ months: monthlySaved }).eq('user_id', uid).eq('year', cy)
      } else {
        await supabase.from('monthly_savings').insert({ user_id: uid, year: cy, months: monthlySaved })
      }

      // 6. Custom categories — replace
      await supabase.from('custom_categories').delete().eq('user_id', uid)
      if (data.customCats.length > 0) {
        await supabase.from('custom_categories').insert(
          data.customCats.map((c, i) => ({
            user_id:    uid,
            name:       c.name,
            icon:       c.icon,
            sort_order: i,
          }))
        )
      }

      setStatus('done')
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div className={s.wrap}>
        <div className={s.icon}>🔍</div>
        <h1 className={s.title}>No Ledge data found</h1>
        <p className={s.sub}>
          Open this page in the same browser where you previously used Ledge.
          Your data is stored in that browser&apos;s localStorage and can&apos;t be read from another device.
        </p>
        <button className={s.btn} onClick={() => router.push('/dashboard')}>Go to Dashboard</button>
      </div>
    )
  }

  // ── Loading ──
  if (!data) {
    return <div className={s.wrap}><p className={s.sub}>Reading data…</p></div>
  }

  // ── Done ──
  if (status === 'done') {
    return (
      <div className={s.wrap}>
        <div className={s.icon}>✓</div>
        <h1 className={s.title}>Migration complete</h1>
        <p className={s.sub}>
          Your Ledge data is now in PocketMate. Transactions, fixed expenses, savings history and
          settings have all been imported.
        </p>
        <button className={s.btn} onClick={() => router.push('/dashboard')}>Open Dashboard</button>
      </div>
    )
  }

  // ── Error ──
  if (status === 'error') {
    return (
      <div className={s.wrap}>
        <div className={s.icon}>⚠</div>
        <h1 className={s.title}>Import failed</h1>
        <p className={s.sub}>{errMsg}</p>
        <button className={s.btn} onClick={() => setStatus('idle')}>Try again</button>
      </div>
    )
  }

  // ── Preview + confirm ──
  return (
    <div className={s.wrap}>
      <div className={s.icon}>📦</div>
      <h1 className={s.title}>Import from Ledge</h1>
      <p className={s.sub}>
        Found your saved Ledge data. Review what will be imported, then confirm.
        This will replace any existing data in your PocketMate account.
      </p>

      <div className={s.preview}>
        <Row label="Name"              value={data.name} />
        <Row label="Income"            value={`$${data.income.toLocaleString()} / ${data.cadence}`} />
        <Row label="Wallet"            value={`$${data.wallet.toLocaleString()}`} />
        <Row label="Total savings"     value={`$${data.totalSavings.toLocaleString()}`} />
        <Row label="Fixed expenses"    value={String(data.fixed.length)} />
        <Row label="Transactions"      value={String(data.transactions.length)} last />
      </div>

      {data.customCats.length > 0 && (
        <p className={s.note}>+ {data.customCats.length} custom {data.customCats.length === 1 ? 'category' : 'categories'}</p>
      )}

      <button className={s.btn} onClick={runMigration} disabled={status === 'running'}>
        {status === 'running' ? 'Importing…' : 'Import data'}
      </button>

      <button className={s.cancelBtn} onClick={() => router.push('/settings')}>Cancel</button>
    </div>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontSize: 14 }}>
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
