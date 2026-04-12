'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppState } from '@/context/AppStateContext'
import { CAT_NAMES, getCatDef, getAllCatNames } from '@/lib/categories'
import { fixedTotal } from '@/lib/finance'
import type { Cadence } from '@/lib/types'
import s from './settings.module.css'

interface FixedRow {
  id?: string
  name: string
  cat: string
  amount: number
  split: number
  paid_this_cycle: boolean
}

interface CatRow {
  id?: string
  name: string
  icon: string
}

export default function SettingsClient() {
  const router = useRouter()
  const { profile, fixedExpenses, customCats, loading, refetch } = useAppState()

  // Profile fields
  const [name,          setName]          = useState('')
  const [income,        setIncome]        = useState(0)
  const [cadence,       setCadence]       = useState<Cadence>('weekly')
  const [extra,         setExtra]         = useState(0)
  const [groceries,     setGroceries]     = useState(0)
  const [dining,        setDining]        = useState(0)
  const [transport,     setTransport]     = useState(0)
  const [entertainment, setEntertainment] = useState(0)
  const [monthlyTarget, setMonthlyTarget] = useState(0)
  const [goalName,      setGoalName]      = useState('')
  const [totalSavings,  setTotalSavings]  = useState(0)

  // Fixed expenses
  const [fixed, setFixed] = useState<FixedRow[]>([])

  // Custom categories
  const [catList,     setCatList]     = useState<CatRow[]>([])
  const [newCatName,  setNewCatName]  = useState('')
  const [newCatIcon,  setNewCatIcon]  = useState('')

  // Save state
  const [saving,    setSaving]    = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'done'>('idle')

  // Seed form from context
  useEffect(() => {
    if (!profile) return
    setName(profile.name)
    setIncome(profile.income)
    setCadence(profile.cadence)
    setExtra(profile.extra)
    setGroceries(profile.groceries)
    setDining(profile.dining)
    setTransport(profile.transport)
    setEntertainment(profile.entertainment)
    setMonthlyTarget(profile.monthly_target)
    setGoalName(profile.goal_name)
    setTotalSavings(profile.total_savings)
  }, [profile])

  useEffect(() => {
    setFixed(fixedExpenses.map(e => ({
      id: e.id,
      name: e.name,
      cat: e.cat,
      amount: e.amount,
      split: e.split,
      paid_this_cycle: e.paid_this_cycle,
    })))
  }, [fixedExpenses])

  useEffect(() => {
    setCatList(customCats.map(c => ({ id: c.id, name: c.name, icon: c.icon })))
  }, [customCats])

  if (loading || !profile) return null

  // ── Fixed expense helpers ─────────────────────────────────────────────────────
  function updateFixed(i: number, field: keyof FixedRow, value: string | number) {
    setFixed(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addFixed() {
    setFixed(prev => [...prev, { name: '', cat: 'Other', amount: 0, split: 1, paid_this_cycle: false }])
  }

  function removeFixed(i: number) {
    setFixed(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Custom cat helpers ────────────────────────────────────────────────────────
  function addCat() {
    const n = newCatName.trim()
    if (!n) return
    const allNames = getAllCatNames(catList as any).map(x => x.toLowerCase())
    if (allNames.includes(n.toLowerCase())) return
    setCatList(prev => [...prev, { name: n, icon: newCatIcon.trim() || '🏷' }])
    setNewCatName('')
    setNewCatIcon('')
  }

  function removeCat(i: number) {
    setCatList(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // 1. Update profile
    await supabase.from('profiles').update({
      name:           name || 'User',
      income,
      cadence,
      extra,
      groceries,
      dining,
      transport,
      entertainment,
      monthly_target: monthlyTarget,
      goal_name:      goalName || 'Savings goal',
      total_savings:  totalSavings,
      updated_at:     new Date().toISOString(),
    }).eq('user_id', user.id)

    // 2. Diff fixed expenses
    const validFixed  = fixed.filter(e => e.name.trim() && e.amount > 0)
    const keptIds     = new Set(validFixed.filter(e => e.id).map(e => e.id!))
    const deletedIds  = fixedExpenses.map(e => e.id).filter(id => !keptIds.has(id))

    if (deletedIds.length > 0) {
      await supabase.from('fixed_expenses').delete().in('id', deletedIds)
    }

    if (validFixed.length > 0) {
      await supabase.from('fixed_expenses').upsert(
        validFixed.map((e, i) => ({
          ...(e.id ? { id: e.id } : {}),
          user_id:          user.id,
          name:             e.name.trim(),
          amount:           e.amount,
          cat:              e.cat,
          split:            Math.max(1, e.split || 1),
          paid_this_cycle:  e.paid_this_cycle,
          sort_order:       i,
        }))
      )
    }

    // 3. Replace custom categories
    await supabase.from('custom_categories').delete().eq('user_id', user.id)
    if (catList.length > 0) {
      await supabase.from('custom_categories').insert(
        catList.map((c, i) => ({
          user_id:    user.id,
          name:       c.name,
          icon:       c.icon || '🏷',
          sort_order: i,
        }))
      )
    }

    await refetch()
    setSaving(false)
    setSaveState('done')
    setTimeout(() => setSaveState('idle'), 3000)
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const fixedTotalAmt = fixed
    .filter(e => e.name.trim() && e.amount > 0)
    .reduce((a, e) => a + e.amount / (e.split || 1), 0)

  const allCatOptions = [...CAT_NAMES]

  return (
    <div>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Settings</h1>
        <p className={s.pageSub}>Update your income, expenses, budgets and savings targets</p>
      </div>

      {/* ── Income ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>Income</div>
        <div className={s.card}>
          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Your name</div>
              <div className={s.rowSub}>Used in greetings</div>
            </div>
            <div className={s.rowControl}>
              <input
                className={s.textInput}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>

          <div className={s.divider} />

          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Take-home pay</div>
              <div className={s.rowSub}>After tax, per pay period</div>
            </div>
            <div className={s.rowControl}>
              <div className={s.inputPrefix}>
                <span>$</span>
                <input type="number" value={income} onChange={e => setIncome(+e.target.value || 0)} />
              </div>
            </div>
          </div>

          <div className={s.divider} />

          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Pay cadence</div>
              <div className={s.rowSub}>How often you get paid</div>
            </div>
            <div className={s.rowControl}>
              <div className={s.cadenceBtns}>
                {(['weekly', 'fortnightly', 'monthly'] as Cadence[]).map(c => (
                  <button
                    key={c}
                    className={`${s.cadenceBtn} ${cadence === c ? s.sel : ''}`}
                    onClick={() => setCadence(c)}
                    type="button"
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={s.divider} />

          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Additional income</div>
              <div className={s.rowSub}>Interest, freelance, other (monthly)</div>
            </div>
            <div className={s.rowControl}>
              <div className={s.inputPrefix}>
                <span>$</span>
                <input type="number" value={extra} placeholder="0" onChange={e => setExtra(+e.target.value || 0)} />
              </div>
              <span className={s.cadenceUnit}>/month</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fixed expenses ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>
          Fixed expenses
          <span className={s.sectionBadge}>${Math.round(fixedTotalAmt).toLocaleString()}/mo</span>
        </div>
        <div className={s.card}>
          {fixed.length === 0 && (
            <div className={s.emptyRow}>No fixed expenses yet.</div>
          )}
          {fixed.map((row, i) => {
            const def = getCatDef(row.cat, [])
            return (
              <div key={i} className={s.fixedRow}>
                <div className={s.fixedDot} style={{ background: def.dot }} />
                <input
                  className={s.feNameInput}
                  type="text"
                  value={row.name}
                  placeholder="Expense name"
                  onChange={e => updateFixed(i, 'name', e.target.value)}
                />
                <select
                  className={s.feCatSelect}
                  value={row.cat}
                  onChange={e => updateFixed(i, 'cat', e.target.value)}
                >
                  {allCatOptions.map(c => <option key={c}>{c}</option>)}
                </select>
                <div className={s.feAmtWrap}>
                  <span>$</span>
                  <input
                    type="number"
                    value={row.amount || ''}
                    placeholder="0"
                    onChange={e => updateFixed(i, 'amount', +e.target.value || 0)}
                  />
                </div>
                <div className={s.splitWrap}>
                  <span>÷</span>
                  <input
                    type="number"
                    min={1} max={10}
                    value={row.split}
                    onChange={e => updateFixed(i, 'split', Math.max(1, +e.target.value || 1))}
                  />
                </div>
                <button className={s.delBtn} type="button" onClick={() => removeFixed(i)}>✕</button>
              </div>
            )
          })}
        </div>
        <button className={s.addRowBtn} type="button" onClick={addFixed}>+ Add fixed expense</button>
      </div>

      {/* ── Weekly budgets ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>Weekly budgets</div>
        <div className={s.card}>
          {[
            { label: 'Groceries',     sub: 'Weekly grocery spend',             val: groceries,     set: setGroceries },
            { label: 'Dining out',    sub: 'Restaurants, cafes, takeaway',      val: dining,        set: setDining },
            { label: 'Transport',     sub: 'Public transport, fuel, rideshare', val: transport,     set: setTransport },
            { label: 'Entertainment', sub: 'Movies, events, hobbies',           val: entertainment, set: setEntertainment },
          ].map(({ label, sub, val, set }, i, arr) => (
            <div key={label}>
              <div className={s.row}>
                <div className={s.rowLabel}>
                  <div className={s.rowName}>{label}</div>
                  <div className={s.rowSub}>{sub}</div>
                </div>
                <div className={s.rowControl}>
                  <div className={s.inputPrefix}>
                    <span>$</span>
                    <input type="number" value={val} onChange={e => set(+e.target.value || 0)} />
                  </div>
                  <span className={s.cadenceUnit}>/week</span>
                </div>
              </div>
              {i < arr.length - 1 && <div className={s.divider} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Custom categories ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>Custom categories</div>
        <div className={s.card}>
          {catList.length === 0 && (
            <div className={s.emptyRow}>No custom categories yet. Add one below.</div>
          )}
          {catList.map((c, i) => (
            <div key={i} className={s.catRow}>
              <span className={s.catRowIcon}>{c.icon || '🏷'}</span>
              <span className={s.catRowName}>{c.name}</span>
              <button className={s.delBtn} type="button" onClick={() => removeCat(i)}>✕</button>
            </div>
          ))}
        </div>
        <div className={s.addCatRow}>
          <input
            className={s.catIconInput}
            type="text"
            maxLength={2}
            placeholder="🏷"
            value={newCatIcon}
            onChange={e => setNewCatIcon(e.target.value)}
          />
          <input
            className={s.catNameInput}
            type="text"
            placeholder="Category name (e.g. Pets, Gaming)"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCat()}
          />
          <button className={s.addCatBtn} type="button" onClick={addCat}>+ Add</button>
        </div>
      </div>

      {/* ── Savings goal ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>Savings goal</div>
        <div className={s.card}>
          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Goal name</div>
            </div>
            <div className={s.rowControl}>
              <input
                className={s.textInput}
                type="text"
                value={goalName}
                placeholder="e.g. Emergency fund, Europe trip"
                onChange={e => setGoalName(e.target.value)}
              />
            </div>
          </div>

          <div className={s.divider} />

          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Monthly savings target</div>
              <div className={s.rowSub}>How much you aim to put away per month</div>
            </div>
            <div className={s.rowControl}>
              <div className={s.inputPrefix}>
                <span>$</span>
                <input type="number" value={monthlyTarget} onChange={e => setMonthlyTarget(+e.target.value || 0)} />
              </div>
              <span className={s.cadenceUnit}>/month</span>
            </div>
          </div>

          <div className={s.divider} />

          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Total savings balance</div>
              <div className={s.rowSub}>Your current savings — cycle leftovers add automatically</div>
            </div>
            <div className={s.rowControl}>
              <div className={s.inputPrefix}>
                <span>$</span>
                <input type="number" value={totalSavings} onChange={e => setTotalSavings(+e.target.value || 0)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save ── */}
      <button className={s.saveBtn} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : saveState === 'done' ? '✓ All changes saved' : 'Save changes'}
      </button>
      {saveState === 'done' && (
        <div className={s.saveConfirm}>✓ All changes saved and dashboard updated</div>
      )}

      {/* ── Account ── */}
      <div className={s.section} style={{ marginTop: 32 }}>
        <div className={s.sectionTitle}>Account</div>
        <div className={s.card}>
          <div className={s.row}>
            <div className={s.rowLabel}>
              <div className={s.rowName}>Import from Ledge</div>
              <div className={s.rowSub}>Migrate data from the original Ledge browser app</div>
            </div>
            <div className={s.rowControl}>
              <button className={s.migrateBtn} type="button" onClick={() => router.push('/migrate')}>Import</button>
            </div>
          </div>
        </div>
        <button className={s.signOutBtn} onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
