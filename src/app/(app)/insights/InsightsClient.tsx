'use client'

import { useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { getCatDef } from '@/lib/categories'
import { grocM, diningM, transM, entM } from '@/lib/finance'
import s from './insights.module.css'

type Range      = 'month' | '3months' | 'year' | 'all'
type ChartMode  = 'cumulative' | 'monthly'

const MONTH_NAMES      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_NAMES_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

// ── SVG chart helpers ──────────────────────────────────────────────────────────
const SVG_W = 560
const SVG_H = 180
const PL = 52, PR = 16, PT = 20, PB = 32
const CW = SVG_W - PL - PR
const CH = SVG_H - PT - PB

function toSvgPt(i: number, total: number, val: number, maxVal: number) {
  const x = PL + (total > 1 ? (i / (total - 1)) : 0.5) * CW
  const y = PT + CH - (maxVal > 0 ? (val / maxVal) * CH : 0)
  return { x, y }
}

function svgLine(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return ''
  return 'M ' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')
}

function svgArea(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return ''
  const bottom = PT + CH
  return (
    `M ${pts[0].x.toFixed(1)},${bottom} ` +
    pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${pts[pts.length - 1].x.toFixed(1)},${bottom} Z`
  )
}

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'month',   label: 'This month' },
  { key: '3months', label: '3 months' },
  { key: 'year',    label: 'This year' },
  { key: 'all',     label: 'All time' },
]

export default function InsightsClient() {
  const { transactions, profile, customCats, loading } = useAppState()
  const [range,     setRange]     = useState<Range>('month')
  const [chartMode, setChartMode] = useState<ChartMode>('cumulative')

  if (loading || !profile) return <div className={s.loading}>Loading…</div>

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ── Transactions in selected range ────────────────────────────────────────────
  const from = rangeStart(range)
  const expensesInRange = transactions.filter(t => !t.is_positive && new Date(t.date) >= from)
  const totalSpent = expensesInRange.reduce((a, t) => a + t.amount, 0)

  // ── Spending by category ──────────────────────────────────────────────────────
  const byCat: Record<string, number> = {}
  for (const t of expensesInRange) byCat[t.cat] = (byCat[t.cat] || 0) + t.amount
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const maxCatAmt  = catEntries[0]?.[1] || 1

  // ── Budget vs actual (current month) ─────────────────────────────────────────
  const thisMonthExpenses = transactions.filter(t => !t.is_positive && t.date.startsWith(thisMonth))
  const spentByCat: Record<string, number> = {}
  for (const t of thisMonthExpenses) spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount
  const budgetItems = [
    { label: 'Groceries',     budget: grocM(profile.groceries),     spent: spentByCat['Groceries']     || 0 },
    { label: 'Dining',        budget: diningM(profile.dining),       spent: spentByCat['Dining']        || 0 },
    { label: 'Transport',     budget: transM(profile.transport),     spent: spentByCat['Transport']     || 0 },
    { label: 'Entertainment', budget: entM(profile.entertainment),   spent: spentByCat['Entertainment'] || 0 },
  ]

  // ── Top expenses ─────────────────────────────────────────────────────────────
  const topExpenses = [...expensesInRange].sort((a, b) => b.amount - a.amount).slice(0, 8)

  // ── Cumulative spending — current month ───────────────────────────────────────
  const currentDay = now.getDate()
  const dailyAmts = Array.from({ length: currentDay }, (_, i) => {
    const dayStr = `${thisMonth}-${String(i + 1).padStart(2, '0')}`
    return thisMonthExpenses.filter(t => t.date === dayStr).reduce((a, t) => a + t.amount, 0)
  })
  const cumulative = dailyAmts.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] ?? 0) + v)
    return acc
  }, [])
  const maxCumulative = Math.max(...cumulative, 1)

  // X labels for cumulative chart: day 1, every ~5 days, today
  const cumXLabels: { i: number; label: string }[] = []
  for (let d = 0; d < currentDay; d++) {
    if (d === 0 || d === currentDay - 1 || (d + 1) % 5 === 0) {
      cumXLabels.push({ i: d, label: String(d + 1) })
    }
  }

  const cumPts = cumulative.map((v, i) => toSvgPt(i, currentDay, v, maxCumulative))

  // ── Monthly totals — last 12 months ──────────────────────────────────────────
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const monthlySpent: Record<string, number> = {}
  for (const t of transactions) {
    if (!t.is_positive && new Date(t.date) >= cutoff) {
      const key = t.date.substring(0, 7)
      monthlySpent[key] = (monthlySpent[key] || 0) + t.amount
    }
  }
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: MONTH_NAMES[d.getMonth()], amt: monthlySpent[key] || 0, isCurrent: key === thisMonth }
  })
  const maxMonthly = Math.max(...last12.map(m => m.amt), 1)
  const monthPts   = last12.map((m, i) => toSvgPt(i, 12, m.amt, maxMonthly))

  // Y-axis tick values helper
  function yTickLabel(frac: number, maxVal: number) {
    return fmtShort(Math.round(frac * maxVal))
  }

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

      {/* ── Spending chart ── */}
      <div className={s.card} style={{ marginBottom: 24 }}>
        <div className={s.chartHeader}>
          <div className={s.cardTitle} style={{ marginBottom: 0 }}>Spending chart</div>
          <div className={s.chartToggle}>
            <button
              className={`${s.chartToggleBtn} ${chartMode === 'cumulative' ? s.active : ''}`}
              onClick={() => setChartMode('cumulative')}
            >
              This month
            </button>
            <button
              className={`${s.chartToggleBtn} ${chartMode === 'monthly' ? s.active : ''}`}
              onClick={() => setChartMode('monthly')}
            >
              By month
            </button>
          </div>
        </div>

        {chartMode === 'cumulative' ? (
          <>
            <div className={s.chartSubtitle}>
              Cumulative spending — {MONTH_NAMES_LONG[now.getMonth()]} {now.getFullYear()}
              <span className={s.chartTotal}>{fmt(cumulative[cumulative.length - 1] ?? 0)} so far</span>
            </div>
            {cumulative.length === 0 || maxCumulative === 0 ? (
              <div className={s.empty}>No expenses logged this month yet</div>
            ) : (
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={s.chartSvg}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <line key={f}
                    x1={PL} y1={(PT + CH - f * CH).toFixed(1)}
                    x2={PL + CW} y2={(PT + CH - f * CH).toFixed(1)}
                    stroke="var(--border)" strokeWidth="1"
                  />
                ))}

                {/* Y axis labels */}
                {[0, 0.5, 1].map(f => (
                  <text key={f}
                    x={PL - 6} y={(PT + CH - f * CH + 4).toFixed(1)}
                    textAnchor="end" fontSize="10" fill="var(--text3)"
                  >
                    {f === 0 ? '$0' : yTickLabel(f, maxCumulative)}
                  </text>
                ))}

                {/* Area fill */}
                <path d={svgArea(cumPts)} fill="url(#cumGrad)" />

                {/* Line */}
                <path d={svgLine(cumPts)} fill="none" stroke="var(--accent)" strokeWidth="2.5"
                  strokeLinejoin="round" strokeLinecap="round" />

                {/* End dot */}
                <circle
                  cx={cumPts[cumPts.length - 1]?.x} cy={cumPts[cumPts.length - 1]?.y}
                  r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2"
                />

                {/* X axis labels */}
                {cumXLabels.map(({ i, label }) => {
                  const p = toSvgPt(i, currentDay, 0, 1)
                  return (
                    <text key={i} x={p.x.toFixed(1)} y={SVG_H - 6}
                      textAnchor="middle" fontSize="10" fill="var(--text3)"
                    >
                      {label}
                    </text>
                  )
                })}
              </svg>
            )}
          </>
        ) : (
          <>
            <div className={s.chartSubtitle}>
              Total spending per month — last 12 months
              <span className={s.chartTotal}>{fmt(last12.reduce((a, m) => a + m.amt, 0))} total</span>
            </div>
            {maxMonthly === 0 ? (
              <div className={s.empty}>No spending data yet</div>
            ) : (
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={s.chartSvg}>
                <defs>
                  <linearGradient id="monGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--red)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--red)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <line key={f}
                    x1={PL} y1={(PT + CH - f * CH).toFixed(1)}
                    x2={PL + CW} y2={(PT + CH - f * CH).toFixed(1)}
                    stroke="var(--border)" strokeWidth="1"
                  />
                ))}

                {/* Y axis labels */}
                {[0, 0.5, 1].map(f => (
                  <text key={f}
                    x={PL - 6} y={(PT + CH - f * CH + 4).toFixed(1)}
                    textAnchor="end" fontSize="10" fill="var(--text3)"
                  >
                    {f === 0 ? '$0' : yTickLabel(f, maxMonthly)}
                  </text>
                ))}

                {/* Area fill */}
                <path d={svgArea(monthPts)} fill="url(#monGrad)" />

                {/* Line */}
                <path d={svgLine(monthPts)} fill="none" stroke="var(--red)" strokeWidth="2.5"
                  strokeLinejoin="round" strokeLinecap="round" />

                {/* Dots — current month highlighted */}
                {last12.map((m, i) => (
                  <circle key={m.key}
                    cx={monthPts[i].x.toFixed(1)} cy={monthPts[i].y.toFixed(1)}
                    r={m.isCurrent ? 5 : 3}
                    fill={m.isCurrent ? 'var(--accent)' : 'var(--red)'}
                    stroke="var(--surface)" strokeWidth="2"
                  />
                ))}

                {/* X axis labels */}
                {last12.map((m, i) => (
                  <text key={m.key}
                    x={monthPts[i].x.toFixed(1)} y={SVG_H - 6}
                    textAnchor="middle" fontSize="10"
                    fill={m.isCurrent ? 'var(--accent)' : 'var(--text3)'}
                    fontWeight={m.isCurrent ? '700' : '400'}
                  >
                    {m.label}
                  </text>
                ))}
              </svg>
            )}
          </>
        )}
      </div>

      {/* Two-col grid: category breakdown + top expenses */}
      <div className={s.grid}>
        <div className={s.card}>
          <div className={s.cardTitle}>Spending by category</div>
          {catEntries.length === 0 ? (
            <div className={s.empty}>No expenses in this period</div>
          ) : (
            <div className={s.catList}>
              {catEntries.map(([cat, amt]) => {
                const def   = getCatDef(cat, customCats)
                const pct   = Math.round(amt / maxCatAmt * 100)
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
