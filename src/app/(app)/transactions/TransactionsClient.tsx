'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppState } from '@/context/AppStateContext'
import s from './transactions.module.css'

const MONTH_NAMES_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function TransactionsClient() {
  const { transactions, loading, isGuest, refetch, guestUpdate } = useAppState()
  const [filter, setFilter] = useState<'all' | 'expenses' | 'income'>('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const now = new Date()
  const cm = now.getMonth()
  const year = now.getFullYear()

  const filtered = transactions.filter(t => {
    if (filter === 'expenses') return !t.is_positive
    if (filter === 'income')   return t.is_positive
    return true
  })

  // Group by year-month
  const groups: Record<string, typeof transactions> = {}
  for (const t of filtered) {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  function groupLabel(key: string) {
    const [y, m] = key.split('-').map(Number)
    const name = MONTH_NAMES_LONG[m - 1]
    return y === year ? name : `${name} ${y}`
  }

  async function deleteTransaction(id: string) {
    if (deletingId) return
    setDeletingId(id)

    if (isGuest) {
      const current = JSON.parse(localStorage.getItem('pm_guest_data') || '{}')
      const updated = (current.transactions ?? []).filter((t: { id: string }) => t.id !== id)
      guestUpdate({ transactions: updated })
      setConfirmId(null)
      setDeletingId(null)
      return
    }

    const supabase = createClient()
    await supabase.from('transactions').delete().eq('id', id)
    setConfirmId(null)
    setDeletingId(null)
    await refetch()
  }

  if (loading) return <div className={s.loading}>Loading…</div>

  return (
    <div>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Transactions</h1>
          <p className={s.pageSub}>{MONTH_NAMES_LONG[cm]} {year}</p>
        </div>
        <div className={s.filterRow}>
          {(['all', 'expenses', 'income'] as const).map(f => (
            <button
              key={f}
              className={`${s.filterBtn} ${filter === f ? s.active : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={s.card}>
          <div className={s.empty}>No transactions yet — log an expense to get started.</div>
        </div>
      ) : (
        sortedKeys.map(key => (
          <div key={key} className={s.card} style={{ marginBottom: 16 }}>
            <div className={s.cardTitle}>{groupLabel(key)}</div>
            <div className={s.txnList}>
              {groups[key].map(t => {
                const isConfirming = confirmId === t.id
                return (
                  <div
                    key={t.id}
                    className={`${s.txnItem} ${isConfirming ? s.confirming : ''}`}
                  >
                    <div className={s.txnIcon} style={{ background: t.bg }}>{t.icon}</div>
                    <div className={s.txnInfo}>
                      <div className={s.txnName}>{t.name}</div>
                      <div className={s.txnCat}>{t.cat}</div>
                    </div>
                    <div className={s.txnRight}>
                      <div className={`${s.txnAmt} ${t.is_positive ? s.pos : s.neg}`}>
                        {t.is_positive ? '+' : '−'}{fmt(t.amount)}
                      </div>
                      <div className={s.txnDate}>{fmtDate(t.date)}</div>
                    </div>
                    {isConfirming ? (
                      <div className={s.confirmActions}>
                        <button
                          className={s.confirmDelete}
                          onClick={() => deleteTransaction(t.id)}
                          disabled={deletingId === t.id}
                        >
                          {deletingId === t.id ? '…' : 'Delete'}
                        </button>
                        <button
                          className={s.confirmCancel}
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className={s.delBtn}
                        onClick={() => setConfirmId(t.id)}
                        aria-label="Delete transaction"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
