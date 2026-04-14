'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppState } from '@/context/AppStateContext'
import { useTheme } from '@/context/ThemeContext'
import { writeVault } from '@/lib/vault'
import {
  mul, monthlyIncome, fixedTotal,
  grocM, diningM, transM, entM,
  totalOut, leftover, cycleLabel, ytd, currentMonth,
} from '@/lib/finance'
import {
  CAT_DEFS, getCatDef, getCatIcon, getCatBg,
} from '@/lib/categories'
import type { FixedExpense, Transaction } from '@/lib/types'
import s from './dashboard.module.css'

const MONTH_NAMES      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_NAMES_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n: number) {
  return '$' + Math.round(Math.abs(n)).toLocaleString()
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DashboardClient() {
  const { profile, cycleState, fixedExpenses, transactions, monthlySavings, customCats, loading, isGuest, refetch, guestUpdate } = useAppState()
  const { theme, toggle } = useTheme()
  const [paidLoading, setPaidLoading] = useState(false)
  const [paidBtn, setPaidBtn] = useState<'idle' | 'done'>('idle')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [confirmTxnId, setConfirmTxnId] = useState<string | null>(null)
  const [deletingTxnId, setDeletingTxnId] = useState<string | null>(null)

  if (loading) return <div className={s.loading}>Loading…</div>
  if (!profile || !cycleState) return <div className={s.loading}>No data found.</div>

  // ── Derived values ────────────────────────────────────────────────────────────
  const { income, cadence, extra, groceries, dining, transport, entertainment, monthly_target, goal_name, total_savings } = profile
  const { wallet, cycle_income, has_first_pay, last_cycle_saved, cycle_spending } = cycleState
  const cm = currentMonth()
  const m = mul(cadence)

  const monthInc = monthlyIncome(income, cadence, extra)
  const spend = totalOut(fixedExpenses, groceries, dining, transport, entertainment)
  const left = leftover(income, cadence, extra, fixedExpenses, groceries, dining, transport, entertainment)
  const months = monthlySavings?.months ?? new Array(12).fill(0)
  const ytdAmt = ytd(months)
  const lockedThisMonth = months[cm] ?? 0
  const paidOut = has_first_pay ? Math.max(0, cycle_income - wallet) : 0
  const label = cycleLabel(cadence)


  // ── "I Got Paid" ─────────────────────────────────────────────────────────────
  async function gotPaid() {
    if (paidLoading) return
    setPaidLoading(true)

    const now = new Date()
    const todayISO = now.toISOString().split('T')[0]
    const payLabel = cadence === 'weekly' ? 'Weekly pay'
      : cadence === 'fortnightly' ? 'Fortnightly pay' : 'Monthly pay'

    let savedThisCycle = 0
    const newMonths = [...months]
    if (has_first_pay && wallet > 0) {
      savedThisCycle = wallet
      newMonths[cm] = (newMonths[cm] || 0) + wallet
    }
    const newLastSaved = has_first_pay ? (wallet <= 0 ? 0 : wallet) : null

    // ── Guest branch ──────────────────────────────────────────────────────────
    if (isGuest) {
      const newTxns: Transaction[] = [...transactions]
      if (savedThisCycle > 0) {
        newTxns.unshift({
          id: crypto.randomUUID(), user_id: 'guest',
          icon: '🏦', bg: 'var(--accent-dim)',
          name: 'Cycle savings', cat: 'Savings',
          amount: savedThisCycle, is_positive: true,
          date: todayISO, created_at: now.toISOString(),
        })
      }
      newTxns.unshift({
        id: crypto.randomUUID(), user_id: 'guest',
        icon: '💵', bg: 'var(--blue-dim)',
        name: payLabel + ' received', cat: 'Income',
        amount: income, is_positive: true,
        date: todayISO, created_at: now.toISOString(),
      })
      guestUpdate({
        wallet: income,
        cycle_income: income,
        has_first_pay: true,
        last_paid_date: now.toISOString(),
        last_cycle_saved: newLastSaved,
        cycle_spending: {},
        total_savings: total_savings + savedThisCycle,
        months: newMonths,
        transactions: newTxns,
        fixed: fixedExpenses.map(e => ({ ...e, paid_this_cycle: false })),
      })
      setPaidLoading(false)
      setPaidBtn('done')
      setTimeout(() => setPaidBtn('idle'), 2500)
      return
    }

    // ── Authenticated branch ──────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPaidLoading(false); return }

    // Write sensitive values via vault
    await writeVault({
      total_savings: total_savings + savedThisCycle,
      months: newMonths,
      wallet: income,
      cycle_income: income,
      last_cycle_saved: newLastSaved,
    })

    // Non-sensitive: reset bills, insert transactions, update cycle_state
    await supabase.from('fixed_expenses')
      .update({ paid_this_cycle: false })
      .eq('user_id', user.id)

    if (savedThisCycle > 0) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        icon: '🏦', bg: 'var(--accent-dim)',
        name: 'Cycle savings', cat: 'Savings',
        amount: savedThisCycle, is_positive: true,
        date: todayISO,
      })
    }

    await supabase.from('transactions').insert({
      user_id: user.id,
      icon: '💵', bg: 'var(--blue-dim)',
      name: payLabel + ' received', cat: 'Income',
      amount: income, is_positive: true,
      date: todayISO,
    })

    await supabase.from('cycle_state').update({
      has_first_pay: true,
      last_paid_date: now.toISOString(),
      cycle_spending: {},
      updated_at: now.toISOString(),
    }).eq('user_id', user.id)

    await refetch()
    setPaidLoading(false)
    setPaidBtn('done')
    setTimeout(() => setPaidBtn('idle'), 2500)
  }

  // ── Pay a bill ────────────────────────────────────────────────────────────────
  async function payBill(bill: FixedExpense) {
    if (payingId || bill.paid_this_cycle) return
    setPayingId(bill.id)

    const billAmt = bill.amount / (bill.split || 1)
    const newWallet = wallet - billAmt
    const newSpending = { ...cycle_spending }
    newSpending[bill.cat] = (newSpending[bill.cat] || 0) + billAmt
    const todayISO = new Date().toISOString().split('T')[0]

    // ── Guest branch ──────────────────────────────────────────────────────────
    if (isGuest) {
      guestUpdate({
        wallet: newWallet,
        cycle_spending: newSpending,
        fixed: fixedExpenses.map(e => e.id === bill.id ? { ...e, paid_this_cycle: true } : e),
        transactions: [{
          id: crypto.randomUUID(), user_id: 'guest',
          icon: getCatIcon(bill.cat, customCats),
          bg: getCatBg(bill.cat, customCats),
          name: bill.name, cat: bill.cat,
          amount: billAmt, is_positive: false,
          date: todayISO, created_at: new Date().toISOString(),
        }, ...transactions],
      })
      setPayingId(null)
      return
    }

    // ── Authenticated branch ──────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPayingId(null); return }

    await writeVault({ wallet: newWallet })

    await supabase.from('fixed_expenses')
      .update({ paid_this_cycle: true })
      .eq('id', bill.id)

    await supabase.from('cycle_state').update({
      cycle_spending: newSpending,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)

    await supabase.from('transactions').insert({
      user_id: user.id,
      icon: getCatIcon(bill.cat, customCats),
      bg: getCatBg(bill.cat, customCats),
      name: bill.name, cat: bill.cat,
      amount: billAmt, is_positive: false,
      date: todayISO,
    })

    await refetch()
    setPayingId(null)
  }

  // ── Delete a transaction ──────────────────────────────────────────────────────
  async function deleteDashboardTxn(t: Transaction) {
    if (deletingTxnId) return
    setDeletingTxnId(t.id)

    // Restore wallet only for current-cycle expenses
    const restoreWallet = !t.is_positive &&
      has_first_pay &&
      cycleState?.last_paid_date != null &&
      t.date >= cycleState.last_paid_date.split('T')[0]

    if (isGuest) {
      const current = JSON.parse(localStorage.getItem('pm_guest_data') || '{}')
      const updatedTxns = (current.transactions ?? []).filter((tx: { id: string }) => tx.id !== t.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = { transactions: updatedTxns }

      if (restoreWallet) {
        const newSpending = { ...(current.cycle_spending ?? {}) }
        newSpending[t.cat] = Math.max(0, (newSpending[t.cat] || 0) - t.amount)
        updates.cycle_spending = newSpending
        updates.wallet = (current.wallet ?? 0) + t.amount
      }

      guestUpdate(updates)
      setConfirmTxnId(null)
      setDeletingTxnId(null)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeletingTxnId(null); return }

    if (restoreWallet) {
      const newSpending = { ...cycle_spending }
      newSpending[t.cat] = Math.max(0, (newSpending[t.cat] || 0) - t.amount)
      await Promise.all([
        writeVault({ wallet: wallet + t.amount }),
        supabase.from('cycle_state').update({
          cycle_spending: newSpending,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id),
      ])
    }

    await supabase.from('transactions').delete().eq('id', t.id)
    setConfirmTxnId(null)
    setDeletingTxnId(null)
    await refetch()
  }

  // ── Balance bar segments ──────────────────────────────────────────────────────
  interface Seg { label: string; amt: number; color: string; dot: string; tc: string }
  let segs: Seg[] = []
  let barTotal = 1

  if (has_first_pay) {
    const totalSpent = Object.values(cycle_spending).reduce((a, v) => a + v, 0)
    Object.entries(cycle_spending).forEach(([cat, amt]) => {
      if (amt > 0) {
        const def = getCatDef(cat, customCats)
        segs.push({ label: cat, amt, color: def.bar, dot: def.dot, tc: def.tc })
      }
    })
    const remaining = Math.max(0, wallet)
    if (remaining > 0) segs.push({ label: 'Remaining', amt: remaining, color: 'var(--surface3)', dot: 'var(--surface3)', tc: 'var(--text3)' })
    if (segs.length === 0) segs.push({ label: 'No expenses yet', amt: cycle_income || 1, color: 'var(--surface3)', dot: 'var(--surface3)', tc: 'var(--text3)' })
    barTotal = Math.max(cycle_income, totalSpent) || 1
  } else {
    const fbcat: Record<string, number> = {}
    fixedExpenses.forEach(e => {
      const c = e.cat || 'Other'
      fbcat[c] = (fbcat[c] || 0) + e.amount / (e.split || 1)
    })
    Object.entries(fbcat).forEach(([cat, amt]) => {
      const def = CAT_DEFS[cat] ?? CAT_DEFS['Other']
      segs.push({ label: cat, amt, color: def.bar, dot: def.dot, tc: def.tc })
    })
    segs.push({ label: 'Groceries',     amt: grocM(groceries),   color: CAT_DEFS['Groceries'].bar,     dot: CAT_DEFS['Groceries'].dot,     tc: CAT_DEFS['Groceries'].tc })
    segs.push({ label: 'Dining',        amt: diningM(dining),     color: CAT_DEFS['Dining'].bar,        dot: CAT_DEFS['Dining'].dot,        tc: CAT_DEFS['Dining'].tc })
    segs.push({ label: 'Transport',     amt: transM(transport),   color: CAT_DEFS['Transport'].bar,     dot: CAT_DEFS['Transport'].dot,     tc: CAT_DEFS['Transport'].tc })
    segs.push({ label: 'Entertainment', amt: entM(entertainment), color: CAT_DEFS['Entertainment'].bar, dot: CAT_DEFS['Entertainment'].dot, tc: CAT_DEFS['Entertainment'].tc })
    segs.push({ label: 'Projected left', amt: Math.max(0, left), color: 'var(--surface3)',              dot: 'var(--surface3)',              tc: 'var(--text3)' })
    barTotal = monthInc || 1
  }

  // ── Spending bar chart items ──────────────────────────────────────────────────
  const varItems = [
    { label: 'Groceries',     amt: grocM(groceries),   cat: 'Groceries' },
    { label: 'Dining out',    amt: diningM(dining),     cat: 'Dining' },
    { label: 'Transport',     amt: transM(transport),   cat: 'Transport' },
    { label: 'Entertainment', amt: entM(entertainment), cat: 'Entertainment' },
  ]
  const chartItems = [
    ...fixedExpenses.map(e => ({ label: e.name, amt: e.amount / (e.split || 1), cat: e.cat })),
    ...varItems,
  ].sort((a, b) => b.amt - a.amt).slice(0, 8)
  const maxAmt = chartItems[0]?.amt || 1

  // ── Savings progress ──────────────────────────────────────────────────────────
  const savingsPct = Math.min(100, Math.round(lockedThisMonth / Math.max(monthly_target, 1) * 100))
  const savingsBarColor = lockedThisMonth >= monthly_target ? 'var(--accent)'
    : lockedThisMonth >= monthly_target * 0.7 ? 'var(--amber)' : 'var(--red)'
  let savingsStatusText = ''
  let savingsStatusClass = 'good'
  if (lockedThisMonth === 0) { savingsStatusText = 'Hit "I got paid" to log your first cycle'; savingsStatusClass = 'warn' }
  else if (lockedThisMonth >= monthly_target) { savingsStatusText = '✓ Above target this month'; savingsStatusClass = 'good' }
  else if (lockedThisMonth >= monthly_target * 0.7) { savingsStatusText = `Almost there — ${fmt(monthly_target - lockedThisMonth)} short`; savingsStatusClass = 'warn' }
  else { savingsStatusText = `Below target by ${fmt(monthly_target - lockedThisMonth)}`; savingsStatusClass = 'bad' }

  // ── YTD stats ─────────────────────────────────────────────────────────────────
  const monthsWithData = months.slice(0, cm + 1).filter(v => v > 0)
  const avgSaved = monthsWithData.length ? Math.round(ytdAmt / monthsWithData.length) : 0
  const bestAmt = Math.max(...months, 0)
  const bestIdx = months.indexOf(bestAmt)
  const ytdSub = cm === 0 ? 'saved in Jan' : `saved across ${MONTH_NAMES[0]} – ${MONTH_NAMES[cm]}`

  // ── Monthly grid ──────────────────────────────────────────────────────────────
  const maxV = Math.max(...months, monthly_target, 1)

  // ── Budget bars ───────────────────────────────────────────────────────────────
  const budgets = [
    { key: 'Groceries',     icon: '🛒', weekly: groceries },
    { key: 'Dining',        icon: '🍽', weekly: dining },
    { key: 'Transport',     icon: '🚌', weekly: transport },
    { key: 'Entertainment', icon: '🎬', weekly: entertainment },
  ]
  const cadenceLabel = cadence === 'weekly' ? '/wk' : cadence === 'fortnightly' ? '/fort' : '/mo'

  // ── Banner content ────────────────────────────────────────────────────────────
  const bannerLabel = has_first_pay ? 'Current wallet' : 'Your next pay'
  const bannerAmt = has_first_pay
    ? fmt(wallet) + (wallet < 0 ? ' (overdrawn)' : '')
    : fmt(income)
  const bannerSub = has_first_pay
    ? wallet > 0 ? `Tap "I got paid" to save ${fmt(wallet)} and start a new cycle`
      : wallet === 0 ? 'Nothing left — tap to start a new cycle'
      : 'Overdrawn — tap to start fresh'
    : `You'll receive ${fmt(income)} per ${label}`

  // ── Wallet card ───────────────────────────────────────────────────────────────
  const walletColor = has_first_pay && wallet < 0 ? 'amber' : 'green'

  return (
    <div>
      {/* Header */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>
            {greeting()}, {profile.name} 👋
          </h1>
          <p className={s.pageSub}>
            Here&apos;s your financial picture for {MONTH_NAMES_LONG[cm]} {new Date().getFullYear()}
          </p>
        </div>
        <button className={s.themeBtn} onClick={toggle}>
          {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
        </button>
      </div>

      {/* I Got Paid Banner */}
      <div className={s.paidBanner}>
        <div className={s.bannerInfo}>
          <div className={s.bannerLabel}>{bannerLabel}</div>
          <div className={s.bannerAmt}>{bannerAmt}</div>
          <div className={s.bannerSub}>{bannerSub}</div>
        </div>
        <button
          className={s.btnPaid}
          onClick={() => setShowPayConfirm(true)}
          disabled={paidLoading}
        >
          {paidBtn === 'done' ? '✓ New cycle started!' : paidLoading ? 'Processing…' : '💰 I got paid'}
        </button>
      </div>

      {/* Confirmation modal */}
      {showPayConfirm && (
        <div className={s.modalOverlay} onClick={() => setShowPayConfirm(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalTitle}>Start a new pay cycle?</div>
            <div className={s.modalBody}>
              {has_first_pay && wallet > 0 ? (
                <>
                  This will lock in <strong>{fmt(wallet)}</strong> as savings for this cycle,
                  reset your wallet to <strong>{fmt(income)}</strong>, and mark all bills as unpaid.
                </>
              ) : has_first_pay ? (
                <>
                  This will reset your wallet to <strong>{fmt(income)}</strong> and mark all bills as unpaid.
                  No savings will be recorded this cycle.
                </>
              ) : (
                <>
                  This will set your wallet to <strong>{fmt(income)}</strong> and start your first cycle.
                </>
              )}
            </div>
            <div className={s.modalActions}>
              <button className={s.modalCancel} onClick={() => setShowPayConfirm(false)}>
                Cancel
              </button>
              <button className={s.modalConfirm} onClick={() => { setShowPayConfirm(false); gotPaid() }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className={s.summaryRow}>
        <div className={s.sumCard}>
          <div className={s.sumLabel}>Paid out</div>
          <div className={`${s.sumValue} ${s.red}`}>
            {has_first_pay ? fmt(paidOut) : '—'}
          </div>
          <div className={s.sumMeta}>This cycle</div>
        </div>

        <div className={s.sumCard}>
          <div className={s.sumLabel}>Saved last pay</div>
          <div className={`${s.sumValue} ${s.blue}`}>
            {has_first_pay && last_cycle_saved != null ? fmt(last_cycle_saved) : '—'}
          </div>
          <div className={s.sumMeta}>Previous cycle</div>
        </div>

        <div className={s.sumCard}>
          <div className={s.sumLabel}>Total savings</div>
          <div className={`${s.sumValue} ${s.teal}`}>
            {total_savings > 0 || has_first_pay ? fmt(total_savings) : '—'}
          </div>
          <div className={s.sumMeta}>All time</div>
        </div>
      </div>

      {/* Balance bar */}
      <div className={s.balanceSection}>
        <div className={s.balanceBarWrap}>
          <div className={s.balTitle}>Where your money goes</div>
          <div className={s.balBar}>
            {segs.map((seg, i) => {
              const pct = Math.max(0, Math.round(seg.amt / barTotal * 100))
              return (
                <div
                  key={i}
                  className={s.balSeg}
                  style={{
                    flex: Math.max(pct, 0.1),
                    background: seg.color,
                    color: seg.tc,
                  }}
                >
                  {pct > 6 ? `${pct}%` : ''}
                </div>
              )
            })}
          </div>
          <div className={s.balLegend}>
            {segs.map((seg, i) => (
              <div key={i} className={s.balLegItem}>
                <div className={s.balDot} style={{ background: seg.dot }} />
                {seg.label} ${Math.round(seg.amt).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bills this cycle */}
      <div className={s.card} style={{ marginBottom: 24 }}>
        <div className={s.cardTitle}>Bills this cycle</div>
        {fixedExpenses.length === 0 ? (
          <div className={s.empty}>No bills added — set them up in Settings</div>
        ) : (
          fixedExpenses.map(bill => {
            const def = getCatDef(bill.cat, customCats)
            const billAmt = bill.amount / (bill.split || 1)
            return (
              <div key={bill.id} className={s.billItem}>
                <div className={s.billDot} style={{ background: def.dot }} />
                <div className={s.billInfo}>
                  <div className={s.billName}>{bill.name}</div>
                  <div className={s.billSub}>{bill.cat}{bill.split > 1 ? ` ÷${bill.split}` : ''}</div>
                </div>
                <span className={s.billAmt}>{fmt(billAmt)}</span>
                <button
                  className={`${s.billPayBtn} ${bill.paid_this_cycle ? s.paid : s.unpaid}`}
                  onClick={() => !bill.paid_this_cycle && payBill(bill)}
                  disabled={payingId === bill.id}
                >
                  {payingId === bill.id ? '…' : bill.paid_this_cycle ? '✓ Paid' : 'Pay'}
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Dash grid: spending chart + savings */}
      <div className={s.dashGrid}>
        {/* Spending bar chart */}
        <div className={s.card}>
          <div className={s.cardTitle}>Spending by category</div>
          <div className={s.barChart}>
            {chartItems.map((item, i) => {
              const def = getCatDef(item.cat, customCats)
              const pct = Math.round(item.amt / maxAmt * 100)
              return (
                <div key={i} className={s.barRow}>
                  <div className={s.barLabel}>{item.label}</div>
                  <div className={s.barTrack}>
                    <div className={s.barFill} style={{ width: `${pct}%`, background: def.dot }} />
                  </div>
                  <div className={s.barAmt}>${Math.round(item.amt).toLocaleString()}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Savings card */}
        <div className={s.card}>
          <div className={s.cardTitle}>Savings</div>

          {/* Monthly progress */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>This month</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--accent)' }}>
                {fmt(lockedThisMonth)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              <span>Monthly target</span>
              <span>{fmt(monthly_target)}</span>
            </div>
            <div className={s.smBarTrack}>
              <div className={s.smBarFill} style={{ width: `${savingsPct}%`, background: savingsBarColor }} />
            </div>
            <div className={`${s.smStatus} ${s[savingsStatusClass as 'good' | 'warn' | 'bad']}`}>
              {savingsStatusText}
            </div>
          </div>

          <div className={s.divider} />

          {/* YTD */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
              {goal_name} — year to date
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--accent)', marginBottom: 4 }}>
              {fmt(ytdAmt)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              {ytdSub}
            </div>
            <div className={s.statGrid}>
              <div className={s.statBox}>
                <div className={s.statBoxLabel}>Best month</div>
                <div className={s.statBoxVal}>
                  {bestAmt > 0 ? `${fmt(bestAmt)} (${MONTH_NAMES[bestIdx]})` : '—'}
                </div>
              </div>
              <div className={s.statBox}>
                <div className={s.statBoxLabel}>Monthly avg</div>
                <div className={s.statBoxVal}>
                  {avgSaved > 0 ? `${fmt(avgSaved)}/mo` : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly savings grid */}
      <div className={s.card} style={{ marginBottom: 24 }}>
        <div className={s.cardTitle}>Monthly savings — this year</div>
        <div className={s.monthlyGrid}>
          {months.map((amt, i) => {
            const future = i > cm
            const h = Math.round(amt / maxV * 100)
            const col = future || amt === 0 ? 'var(--surface3)'
              : amt >= monthly_target ? 'var(--accent)'
              : amt >= monthly_target * 0.7 ? 'var(--amber)'
              : 'var(--red)'
            return (
              <div key={i} className={s.monthPip}>
                <div className={s.monthPipBar}>
                  <div className={s.monthPipFill} style={{ height: `${h}%`, background: col }} />
                </div>
                <div className={s.monthPipLbl}>{MONTH_NAMES[i]}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Budget bars */}
      <div className={s.budgetBarsSection}>
        <div className={s.cardTitle} style={{ marginBottom: 12 }}>Spending this cycle</div>
        <div className={s.budgetBarsGrid}>
          {budgets.map(b => {
            const cycleBudget = Math.round(b.weekly * m)
            const spent = Math.round(cycle_spending[b.key] || 0)
            const pct = cycleBudget > 0 ? Math.min(100, Math.round(spent / cycleBudget * 100)) : 0
            const over = spent > cycleBudget
            const close = !over && pct >= 75
            const color = over ? 'var(--red)' : close ? 'var(--amber)' : 'var(--accent)'
            const badgeBg = over ? 'var(--red-dim)' : close ? 'var(--amber-dim)' : 'var(--accent-dim)'
            return (
              <div key={b.key} className={s.bbc}>
                <div className={s.bbcHead}>
                  <span className={s.bbcIcon}>{b.icon}</span>
                  <span className={s.bbcName}>{b.key}</span>
                  <span className={s.bbcBadge} style={{ background: badgeBg, color }}>{pct}%</span>
                </div>
                <div className={s.bbcTrack}>
                  <div className={s.bbcFill} style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className={s.bbcAmounts}>
                  <span className={s.bbcSpent} style={{ color }}>${spent.toLocaleString()} spent</span>
                  <span>${cycleBudget.toLocaleString()}{cadenceLabel}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div className={s.card}>
        <div className={s.cardTitle}>Recent transactions</div>
        {transactions.length === 0 ? (
          <div className={s.empty}>No transactions yet</div>
        ) : (
          <div className={s.txnList}>
            {transactions.slice(0, 5).map(t => {
              const dateObj = new Date(t.date)
              const dateStr = dateObj.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
              const isConfirming = confirmTxnId === t.id
              return (
                <div key={t.id} className={`${s.txnItem} ${isConfirming ? s.confirming : ''}`}>
                  <div className={s.txnIcon} style={{ background: t.bg }}>{t.icon}</div>
                  <div className={s.txnInfo}>
                    <div className={s.txnName}>{t.name}</div>
                    <div className={s.txnCat}>{t.cat}</div>
                  </div>
                  <div className={s.txnRight}>
                    <div className={`${s.txnAmt} ${t.is_positive ? s.pos : s.neg}`}>
                      {t.is_positive ? '+' : '-'}{fmt(t.amount)}
                    </div>
                    <div className={s.txnDate}>{dateStr}</div>
                  </div>
                  {isConfirming ? (
                    <div className={s.confirmActions}>
                      <button
                        className={s.confirmDelete}
                        onClick={() => deleteDashboardTxn(t)}
                        disabled={deletingTxnId === t.id}
                      >
                        {deletingTxnId === t.id ? '…' : 'Delete'}
                      </button>
                      <button
                        className={s.confirmCancel}
                        onClick={() => setConfirmTxnId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className={s.delBtn}
                      onClick={() => setConfirmTxnId(t.id)}
                      aria-label="Delete transaction"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
