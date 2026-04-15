'use client'

import { useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { getCatDef } from '@/lib/categories'
import { grocM, diningM, transM, entM } from '@/lib/finance'
import s from './insights.module.css'

type Range = 'month' | '3months' | 'year' | 'all'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString()
}

function fmtShort(n: number) {
  if (n === 0) return ''
  if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return '$' + Math.round(n)
}

function rangeStart(range: Range): Date {
  const now = new Date()
  if (range === 'month')   return new Date(now.getFullYear(), now.getMonth(), 1)
  if (range === '3months') return new Date(now.getFullYear(), now.getMonth() - 2, 1)
  if (range === 'year')    return new Date(now.getFullYear(), 0, 1)
  return new Date(0)
}

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'month',   label: 'This month' },
  { key: '3months', label: '3 months' },
  { key: 'year',    label: 'This year' },
  { key: 'all',     label: 'All time' },
]

export default function InsightsClient() {
  const { transactions, profile, customCats, loading } = useAppState()
  const [range, setRange] = useState<Range>('month')

  if (loading || !profile) return <div className={s.loading}>Loading…</div>

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ── Transactions in selected range ────────────────────────────────────────────
  const from = rangeStart(range)
  const expensesInRange = transactions.filter(t => !t.is_positive && new Date(t.date) >= from)
  const totalSpent = expensesInRange.reduce((a, t) => a + t.amount, 0)

  // ── Spending by category ──────────────────────────────────────────────────────
  const byCat: Record<string, number> = {}
  for (const t of expensesInRange) {
    byCat[t.cat] = (byCat[t.cat] || 0) + t.amount
  }
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const maxCatAmt = catEntries[0]?.[1] || 1

  // ── Monthly spending — last 12 months ─────────────────────────────────────────
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const monthlySpent: Record<string, number> = {}
  for (const t of transactions) {
    if (!t.is_positive && new Date(t.date) >= cutoff) {
      const key = t.date.substring(0, 7)
      monthlySpent[key] = (monthlySpent[key] || 0) + t.amount
    }
  }
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: MONTH_NAMES[d.getMonth()], amt: monthlySpent[key] || 0 }
  })
  const maxMonthly = Math.max(...last12.map(m => m.amt), 1)

  // ── Budget vs actual (current month) ─────────────────────────────────────────
  const thisMonthExpenses = transactions.filter(t => !t.is_positive && t.date.startsWith(thisMonth))
  const spentByCat: Record<string, number> = {}
  for (const t of thisMonthExpenses) {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount
  }
  const budgetItems = [
    { label: 'Groceries',     budget: grocM(profile.groceries),     spent: spentByCat['Groceries']     || 0 },
    { label: 'Dining',        budget: diningM(profile.dining),       spent: spentByCat['Dining']        || 0 },
    { label: 'Transport',     budget: transM(profile.transport),     spent: spentByCat['Transport']     || 0 },
    { label: 'Entertainment', budget: entM(profile.entertainment),   spent: spentByCat['Entertainment'] || 0 },
  ]

  // ── Top expenses in range ─────────────────────────────────────────────────────
  const topExpenses = [...expensesInRange].sort((a, b) => b.amount - a.amount).slice(0, 8)

  return (
    <div>
      {/* Header */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Insights</h1>
          <p className={s.pageSub}>Understand where your money goes</p>
        </div>
        <div className={s.rangeRow}>
          {RANGE_OPTIONS.map(r => (
            <button
              key={r.key}
              className={`${s.rangeBtn} ${range === r.key ? s.active : ''}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className={s.summaryStrip}>
        <div className={s.summaryItem}>
          <div className={s.summaryLabel}>Total spent</div>
          <div className={s.summaryValue}>{fmt(totalSpent)}</div>
        </div>
        <div className={s.summaryItem}>
          <div className={s.summaryLabel}>Transactions</div>
          <div className={s.summaryValue}>{expensesInRange.length}</div>
        </div>
        <div className={s.summaryItem}>
          <div className={s.summaryLabel}>Categories</div>
          <div className={s.summaryValue}>{catEntries.length}</div>
        </div>
        <div className={s.summaryItem}>
          <div className={s.summaryLabel}>Avg per transaction</div>
          <div className={s.summaryValue}>
            {expensesInRange.length ? fmt(totalSpent / expensesInRange.length) : '—'}
          </div>
        </div>
      </div>

      {/* Two-col grid: category breakdown + top expenses */}
      <div className={s.grid}>
        {/* Spending by category */}
        <div className={s.card}>
          <div className={s.cardTitle}>Spending by category</div>
          {catEntries.length === 0 ? (
            <div className={s.empty}>No expenses in this period</div>
          ) : (
            <div className={s.catList}>
              {catEntries.map(([cat, amt]) => {
                const def = getCatDef(cat, customCats)
                const pct  = Math.round(amt / maxCatAmt * 100)
                const share = Math.round(amt / totalSpent * 100)
                return (
                  <div key={cat} className={s.catRow}>
                    <div className={s.catLabelWrap}>
                      <span className={s.catDot} style={{ background: def.dot }} />
                      <span className={s.catName}>{cat}</span>
                    </div>
                    <div className={s.catBarTrack}>
                      <div className={s.catBar} style={{ width: `${pct}%`, background: def.dot }} />
                    </div>
                    <div className={s.catAmts}>
                      <span className={s.catAmt}>{fmt(amt)}</span>
                      <span className={s.catShare}>{share}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top expenses */}
        <div className={s.card}>
          <div className={s.cardTitle}>Top expenses</div>
          {topExpenses.length === 0 ? (
            <div className={s.empty}>No expenses in this period</div>
          ) : (
            <div className={s.topList}>
              {topExpenses.map(t => (
                <div key={t.id} className={s.topItem}>
                  <div className={s.topIcon} style={{ background: t.bg }}>{t.icon}</div>
                  <div className={s.topInfo}>
                    <div className={s.topName}>{t.name}</div>
                    <div className={s.topMeta}>
                      {t.cat} · {new Date(t.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div className={s.topAmt}>{fmt(t.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly spending bar chart */}
      <div className={s.card} style={{ marginBottom: 24 }}>
        <div className={s.cardTitle}>Monthly spending — last 12 months</div>
        {last12.every(m => m.amt === 0) ? (
          <div className={s.empty}>No spending data yet</div>
        ) : (
          <div className={s.monthlyChart}>
            {last12.map(m => {
              const h = Math.round(m.amt / maxMonthly * 100)
              const isCurrent = m.key === thisMonth
              return (
                <div key={m.key} className={s.monthCol}>
                  <div className={s.monthAmtLabel}>{fmtShort(m.amt)}</div>
                  <div className={s.monthBarWrap}>
                    <div
                      className={s.monthBar}
                      style={{
                        height: `${h}%`,
                        background: isCurrent ? 'var(--accent)' : 'var(--red)',
                        opacity: isCurrent ? 1 : 0.55,
                      }}
                    />
                  </div>
                  <div className={`${s.monthLabel} ${isCurrent ? s.currentMonth : ''}`}>
                    {m.label}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Budget vs actual */}
      <div className={s.card}>
        <div className={s.cardTitle}>Budget vs actual — this month</div>
        <div className={s.budgetList}>
          {budgetItems.map(b => {
            const pct   = b.budget > 0 ? Math.min(100, Math.round(b.spent / b.budget * 100)) : 0
            const over  = b.spent > b.budget
            const close = !over && pct >= 75
            const color = over ? 'var(--red)' : close ? 'var(--amber)' : 'var(--accent)'
            return (
              <div key={b.label} className={s.budgetRow}>
                <div className={s.budgetLabel}>{b.label}</div>
                <div className={s.budgetTrack}>
                  <div className={s.budgetFill} style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className={s.budgetAmts}>
                  <span style={{ color, fontWeight: 600 }}>{fmt(b.spent)}</span>
                  <span className={s.budgetOf}>/ {fmt(b.budget)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
