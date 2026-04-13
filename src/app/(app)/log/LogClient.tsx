'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppState } from '@/context/AppStateContext'
import { writeVault } from '@/lib/vault'
import { getAllCatNames, getCatIcon, getCatBg } from '@/lib/categories'
import type { Transaction } from '@/lib/types'
import s from './log.module.css'

const NUMPAD = ['1','2','3','4','5','6','7','8','9','0','.','⌫']

export default function LogClient() {
  const { profile, cycleState, customCats, loading, isGuest, refetch, guestUpdate, transactions } = useAppState()

  const [logType, setLogType]       = useState<'expense' | 'income'>('expense')
  const [amount, setAmount]         = useState('0')
  const [selectedCat, setSelectedCat] = useState('Groceries')
  const [note, setNote]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [btnState, setBtnState]     = useState<'idle' | 'done'>('idle')

  if (loading) return null
  if (!profile || !cycleState) return null

  const allCats = getAllCatNames(customCats)
  const isIncome = logType === 'income'

  function numPress(v: string) {
    if (v === '⌫') {
      setAmount(prev => prev.slice(0, -1) || '0')
    } else if (v === '.' && amount.includes('.')) {
      return
    } else if (amount === '0' && v !== '.') {
      setAmount(v)
    } else {
      setAmount(prev => prev + v)
    }
  }

  async function submit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    setSubmitting(true)

    const now = new Date()
    const todayISO = now.toISOString().split('T')[0]
    const cs = cycleState!

    // ── Guest branch ──────────────────────────────────────────────────────────
    if (isGuest) {
      const newTxn: Transaction = {
        id: crypto.randomUUID(),
        user_id: 'guest',
        icon: isIncome ? '💵' : getCatIcon(selectedCat, customCats),
        bg: isIncome ? 'var(--blue-dim)' : getCatBg(selectedCat, customCats),
        name: note.trim() || (isIncome ? 'Income received' : `${selectedCat} expense`),
        cat: isIncome ? 'Income' : selectedCat,
        amount: amt,
        is_positive: isIncome,
        date: todayISO,
        created_at: now.toISOString(),
      }

      const updates: Parameters<typeof guestUpdate>[0] = {
        transactions: [newTxn, ...transactions],
      }

      if (isIncome) {
        if (cs.has_first_pay) updates.wallet = cs.wallet + amt
      } else {
        const newSpending = { ...cs.cycle_spending }
        newSpending[selectedCat] = (newSpending[selectedCat] || 0) + amt
        updates.cycle_spending = newSpending
        if (cs.has_first_pay) updates.wallet = cs.wallet - amt
      }

      guestUpdate(updates)
      setAmount('0')
      setNote('')
      setSubmitting(false)
      setBtnState('done')
      setTimeout(() => setBtnState('idle'), 1500)
      return
    }

    // ── Authenticated branch ──────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    if (isIncome) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        icon: '💵', bg: 'var(--blue-dim)',
        name: note.trim() || 'Income received',
        cat: 'Income', amount: amt, is_positive: true, date: todayISO,
      })
      if (cs.has_first_pay) {
        await writeVault({ wallet: cs.wallet + amt })
      }
    } else {
      const newSpending = { ...cs.cycle_spending }
      newSpending[selectedCat] = (newSpending[selectedCat] || 0) + amt

      await supabase.from('transactions').insert({
        user_id: user.id,
        icon: getCatIcon(selectedCat, customCats),
        bg: getCatBg(selectedCat, customCats),
        name: note.trim() || `${selectedCat} expense`,
        cat: selectedCat, amount: amt, is_positive: false, date: todayISO,
      })

      await writeVault({ wallet: cs.has_first_pay ? cs.wallet - amt : cs.wallet })

      await supabase.from('cycle_state').update({
        cycle_spending: newSpending,
        updated_at: now.toISOString(),
      }).eq('user_id', user.id)
    }

    await refetch()
    setAmount('0')
    setNote('')
    setSubmitting(false)
    setBtnState('done')
    setTimeout(() => setBtnState('idle'), 1500)
  }

  const btnLabel = btnState === 'done'
    ? (isIncome ? '✓ Income logged!' : '✓ Saved!')
    : submitting ? 'Saving…'
    : isIncome ? 'Log income' : 'Save expense'

  return (
    <div>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Log transaction</h1>
        <p className={s.pageSub}>{isIncome ? 'What did you receive?' : 'What did you just spend on?'}</p>
      </div>

      <div className={s.form}>
        {/* Type toggle */}
        <div className={s.typeToggle}>
          <button
            className={`${s.typeBtn} ${!isIncome ? s.active : ''}`}
            onClick={() => setLogType('expense')}
          >Expense</button>
          <button
            className={`${s.typeBtn} ${isIncome ? s.active : ''}`}
            onClick={() => setLogType('income')}
          >Income</button>
        </div>

        {/* Category grid — expense only */}
        {!isIncome && (
          <div>
            <div className={s.sectionLabel}>Category</div>
            <div className={s.catGrid}>
              {allCats.map(cat => (
                <div
                  key={cat}
                  className={`${s.catBtn} ${selectedCat === cat ? s.sel : ''}`}
                  onClick={() => setSelectedCat(cat)}
                >
                  <div className={s.catIcon}>{getCatIcon(cat, customCats)}</div>
                  <div className={s.catLabel}>{cat}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amount */}
        <div className={s.sectionLabel} style={{ marginTop: 8 }}>Amount</div>
        <div className={s.bigAmount}>${amount}</div>

        {/* Numpad */}
        <div className={s.numpad}>
          {NUMPAD.map(key => (
            <div key={key} className={s.numBtn} onClick={() => numPress(key)}>
              {key}
            </div>
          ))}
        </div>

        {/* Note */}
        <div className={s.fieldGroup}>
          <label className={s.fieldLabel}>Note (optional)</label>
          <input
            className={s.noteInput}
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={isIncome ? 'e.g. Marketplace sale, freelance work' : 'e.g. Coles weekly shop'}
          />
        </div>

        <button className={s.submitBtn} onClick={submit} disabled={submitting}>
          {btnLabel}
        </button>
      </div>
    </div>
  )
}
