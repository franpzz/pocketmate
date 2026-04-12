'use client'

import { useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { mul, monthlyIncome, fixedTotal, ytd, currentMonth } from '@/lib/finance'
import s from './whatif.module.css'

const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  return '$' + Math.round(Math.abs(n)).toLocaleString()
}

export default function WhatIfClient() {
  const { profile, fixedExpenses, monthlySavings, loading } = useAppState()

  // Sliders initialised from profile; local state so they don't refetch
  const [groceries,     setGroceries]     = useState<number | null>(null)
  const [dining,        setDining]        = useState<number | null>(null)
  const [transport,     setTransport]     = useState<number | null>(null)
  const [entertainment, setEntertainment] = useState<number | null>(null)

  if (loading) return null
  if (!profile) return null

  // Initialise from profile on first render
  const g = groceries     ?? profile.groceries
  const d = dining        ?? profile.dining
  const t = transport     ?? profile.transport
  const e = entertainment ?? profile.entertainment

  const monthInc  = monthlyIncome(profile.income, profile.cadence, profile.extra)
  const fixed     = fixedTotal(fixedExpenses)
  const newOut    = fixed + Math.round(g*4.33) + Math.round(d*4.33) + Math.round(t*4.33) + Math.round(e*4.33)
  const newLeft   = Math.max(0, monthInc - newOut)

  const baseOut   = fixed + Math.round(profile.groceries*4.33) + Math.round(profile.dining*4.33) + Math.round(profile.transport*4.33) + Math.round(profile.entertainment*4.33)
  const baseLeft  = Math.max(0, monthInc - baseOut)

  const months  = monthlySavings?.months ?? new Array(12).fill(0)
  const ytdAmt  = ytd(months)
  const cm      = currentMonth()

  // 6-month projection from today
  let running = ytdAmt
  const projection = Array.from({ length: 6 }, (_, i) => {
    running += newLeft
    const barH = Math.min(60, Math.round(newLeft / Math.max(profile.monthly_target, 1) * 60))
    return { month: MN[(cm + i + 1) % 12], running, barH }
  })

  function diff(base: number, now: number) {
    return Math.round((base - now) * 4.33)
  }

  const sliders = [
    { label: 'Dining out',    val: d, set: (v: number) => setDining(v),        base: profile.dining,        min: 0,  max: 200, step: 5  },
    { label: 'Groceries',     val: g, set: (v: number) => setGroceries(v),     base: profile.groceries,     min: 40, max: 300, step: 10 },
    { label: 'Transport',     val: t, set: (v: number) => setTransport(v),     base: profile.transport,     min: 0,  max: 300, step: 10 },
    { label: 'Entertainment', val: e, set: (v: number) => setEntertainment(v), base: profile.entertainment, min: 0,  max: 200, step: 5  },
  ]

  return (
    <div>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>What-if simulator</h1>
        <p className={s.pageSub}>See how small changes affect your monthly savings</p>
      </div>

      {/* Summary bar */}
      <div className={s.summary} style={{ marginBottom: 24 }}>
        <div className={s.summaryItem}>
          <div className={s.summaryItemLabel}>Monthly income</div>
          <div className={s.summaryItemVal}>{fmt(monthInc)}</div>
          <div className={s.summaryItemSub}>after tax</div>
        </div>
        <div className={s.summaryItem}>
          <div className={s.summaryItemLabel}>Current leftover</div>
          <div className={s.summaryItemVal} style={{ color: baseLeft > 0 ? 'var(--accent)' : 'var(--red)' }}>
            {fmt(baseLeft)}
          </div>
          <div className={s.summaryItemSub}>per month</div>
        </div>
        <div className={s.summaryItem}>
          <div className={s.summaryItemLabel}>Adjusted leftover</div>
          <div className={s.summaryItemVal} style={{ color: newLeft > baseLeft ? 'var(--teal)' : newLeft < baseLeft ? 'var(--red)' : 'var(--accent)' }}>
            {fmt(newLeft)}
          </div>
          <div className={s.summaryItemSub}>
            {newLeft > baseLeft ? `+${fmt(newLeft - baseLeft)}/mo` : newLeft < baseLeft ? `−${fmt(baseLeft - newLeft)}/mo` : 'no change'}
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className={s.grid}>
        {sliders.map(({ label, val, set, base, min, max, step }) => {
          const saving = diff(base, val)
          return (
            <div key={label} className={s.card}>
              <h3 className={s.cardTitle}>{label}</h3>
              <div className={s.sliderLabel}>
                <span>Weekly spend</span>
                <span className={s.sliderVal}>${val}/wk</span>
              </div>
              <input
                type="range"
                className={s.slider}
                min={min} max={max} step={step}
                value={val}
                onChange={ev => set(Number(ev.target.value))}
              />
              <div className={s.impact}>
                <span className={s.impactLabel}>Monthly saving vs now</span>
                <span
                  className={s.impactVal}
                  style={{ color: saving >= 0 ? 'var(--accent)' : 'var(--red)' }}
                >
                  {saving >= 0 ? '+' : '−'}{fmt(Math.abs(saving))}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Projection */}
      <div className={s.projCard}>
        <div className={s.cardTitle}>Running total projection</div>
        <p className={s.projSub}>Estimated cumulative savings over the next 6 months if you adjust the sliders above</p>
        <div className={s.projTimeline}>
          {projection.map(({ month, running: r, barH }) => (
            <div key={month} className={s.projMonth}>
              <div className={s.pmLabel}>{month}</div>
              <div className={s.pmVal}>${Math.round(r).toLocaleString()}</div>
              <div className={s.pmBar}>
                <div className={s.pmFill} style={{ height: barH }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
