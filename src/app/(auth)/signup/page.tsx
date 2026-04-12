'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import s from '../auth.module.css'

type Cadence = 'weekly' | 'fortnightly' | 'monthly'
type FixedExpense = { name: string; amount: string; cat: string; split: string }

const CAT_OPTIONS = ['Housing', 'Utilities', 'Transport', 'Health', 'Other']

const DEFAULT_EXPENSES: FixedExpense[] = [
  { name: 'Rent', amount: '1600', cat: 'Housing', split: '1' },
  { name: 'Electricity', amount: '120', cat: 'Utilities', split: '1' },
  { name: 'Internet', amount: '80', cat: 'Utilities', split: '1' },
  { name: 'Phone', amount: '45', cat: 'Utilities', split: '1' },
]

export default function SignupPage() {
  const router = useRouter()

  // Step navigation
  const [step, setStep] = useState(0)

  // Step 1 — profile
  const [name, setName] = useState('')
  const [income, setIncome] = useState('')
  const [cadence, setCadence] = useState<Cadence>('weekly')

  // Step 2 — fixed expenses
  const [fixed, setFixed] = useState<FixedExpense[]>(DEFAULT_EXPENSES)

  // Step 3 — lifestyle budgets (stored as weekly $)
  const [groceries, setGroceries] = useState(120)
  const [dining, setDining] = useState(80)
  const [transport, setTransport] = useState(80)
  const [entertainment, setEntertainment] = useState(20)

  // Step 4 — savings + auth
  const [monthlyTarget, setMonthlyTarget] = useState('500')
  const [goalName, setGoalName] = useState('Emergency fund')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  // ── Step 2 helpers ──────────────────────────────────────────────
  function updateFixed(i: number, field: keyof FixedExpense, value: string) {
    setFixed(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }
  function addFixedRow() {
    setFixed(prev => [...prev, { name: '', amount: '', cat: 'Other', split: '1' }])
  }
  function removeFixed(i: number) {
    setFixed(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Final submit ────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    // 1. Create auth account
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    const user = data.user
    if (!user) { setError('Signup failed. Please try again.'); setLoading(false); return }

    // 2. Insert profile
    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: user.id,
      name: name || 'User',
      income: parseFloat(income) || 0,
      cadence,
      extra: 0,
      groceries,
      dining,
      transport,
      entertainment,
      monthly_target: parseFloat(monthlyTarget) || 500,
      goal_name: goalName || 'Savings goal',
      total_savings: 0,
    })
    if (profileError) { setError(profileError.message); setLoading(false); return }

    // 3. Insert cycle_state
    await supabase.from('cycle_state').insert({
      user_id: user.id,
      wallet: 0,
      cycle_income: 0,
      has_first_pay: false,
      cycle_spending: {},
    })

    // 4. Insert fixed expenses
    const validFixed = fixed.filter(f => f.name.trim() && parseFloat(f.amount) > 0)
    if (validFixed.length > 0) {
      await supabase.from('fixed_expenses').insert(
        validFixed.map((f, i) => ({
          user_id: user.id,
          name: f.name.trim(),
          amount: parseFloat(f.amount),
          cat: f.cat,
          split: Math.max(1, parseInt(f.split) || 1),
          paid_this_cycle: false,
          sort_order: i,
        }))
      )
    }

    // 5. Insert initial monthly_savings row for this year
    await supabase.from('monthly_savings').insert({
      user_id: user.id,
      year: new Date().getFullYear(),
      months: new Array(12).fill(0),
    })

    setLoading(false)

    // If email confirmation is required, show the "check email" message
    if (!data.session) {
      setCheckEmail(true)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (checkEmail) {
    return (
      <div className={s.screen}>
        <div className={s.card}>
          <div className={s.logo}>PocketMate</div>
          <h1 className={s.title}>Check your email.</h1>
          <p className={s.sub}>
            We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <Link href="/login" className={s.btnPrimary} style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
            Go to sign in →
          </Link>
        </div>
      </div>
    )
  }

  const dots = [0, 1, 2, 3].map(i => (
    <div key={i} className={`${s.dot} ${i < step ? s.done : ''} ${i === step ? s.active : ''}`} />
  ))

  return (
    <div className={s.screen}>
      <div className={s.card}>
        <div className={s.logo}>PocketMate</div>
        <div className={s.dots}>{dots}</div>

        {/* ── STEP 0 — About you ── */}
        {step === 0 && (
          <>
            <div className={s.stepLabel}>Step 1 of 4 — About you</div>
            <h1 className={s.title}>Let&apos;s get to know you.</h1>
            <p className={s.sub}>We&apos;ll personalise your dashboard based on your income and pay cycle.</p>

            <div className={s.fieldGroup}>
              <label>Your first name</label>
              <input className={s.input} type="text" placeholder="e.g. Alex" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className={s.fieldGroup}>
              <label>Take-home income</label>
              <div className={s.inputPrefix}>
                <span>$</span>
                <input type="number" placeholder="0.00" value={income} onChange={e => setIncome(e.target.value)} />
              </div>
            </div>

            <div className={s.fieldGroup}>
              <label>Paid</label>
              <div className={s.cadenceBtns}>
                {(['weekly', 'fortnightly', 'monthly'] as Cadence[]).map(c => (
                  <button key={c} className={`${s.cadenceBtn} ${cadence === c ? s.sel : ''}`} onClick={() => setCadence(c)} type="button">
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button className={s.btnPrimary} type="button" onClick={() => setStep(1)}>Continue →</button>
            <div className={s.footerLink}>Already have an account? <Link href="/login">Sign in</Link></div>
          </>
        )}

        {/* ── STEP 1 — Fixed expenses ── */}
        {step === 1 && (
          <>
            <div className={s.stepLabel}>Step 2 of 4 — Fixed expenses</div>
            <h1 className={s.title}>What are your regular bills?</h1>
            <p className={s.sub}>Add your fixed expenses, pick a category, and use ÷ to split shared costs.</p>

            {fixed.map((row, i) => (
              <div key={i} className={s.expenseRow}>
                <input placeholder="Name" value={row.name} onChange={e => updateFixed(i, 'name', e.target.value)} />
                <select value={row.cat} onChange={e => updateFixed(i, 'cat', e.target.value)}>
                  {CAT_OPTIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                <div className={s.inputPrefix}>
                  <span>$</span>
                  <input type="number" placeholder="0" value={row.amount} onChange={e => updateFixed(i, 'amount', e.target.value)} />
                </div>
                <div className={s.splitWrap}>
                  <span>÷</span>
                  <input type="number" min="1" max="10" value={row.split} onChange={e => updateFixed(i, 'split', e.target.value)} />
                </div>
                <button className={s.delBtn} type="button" onClick={() => removeFixed(i)}>✕</button>
              </div>
            ))}

            <button className={s.addRowBtn} type="button" onClick={addFixedRow}>+ Add another</button>
            <button className={s.btnPrimary} type="button" onClick={() => setStep(2)}>Continue →</button>
          </>
        )}

        {/* ── STEP 2 — Lifestyle ── */}
        {step === 2 && (
          <>
            <div className={s.stepLabel}>Step 3 of 4 — Lifestyle</div>
            <h1 className={s.title}>How do you like to live?</h1>
            <p className={s.sub}>Rough estimates — you can fine-tune everything in Settings later.</p>

            {[
              { label: 'Groceries', val: groceries, set: setGroceries, min: 20, max: 400, step: 10 },
              { label: 'Dining out', val: dining, set: setDining, min: 0, max: 200, step: 5 },
              { label: 'Transport', val: transport, set: setTransport, min: 0, max: 200, step: 5 },
              { label: 'Entertainment', val: entertainment, set: setEntertainment, min: 0, max: 200, step: 5 },
            ].map(({ label, val, set, min, max, step: step_ }) => (
              <div key={label} className={s.sliderRow}>
                <span>{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step_}
                  value={val}
                  onChange={e => set(Number(e.target.value))}
                />
                <span className={s.sliderVal}>${val}/wk</span>
              </div>
            ))}

            <button className={s.btnPrimary} type="button" onClick={() => setStep(3)}>Continue →</button>
          </>
        )}

        {/* ── STEP 3 — Savings + auth ── */}
        {step === 3 && (
          <form onSubmit={handleSignup}>
            <div className={s.stepLabel}>Step 4 of 4 — Savings &amp; account</div>
            <h1 className={s.title}>Almost there.</h1>
            <p className={s.sub}>Set your savings goal and create your account.</p>

            <div className={s.fieldGroup}>
              <label>Monthly savings target</label>
              <div className={s.inputPrefix}>
                <span>$</span>
                <input type="number" placeholder="500" value={monthlyTarget} onChange={e => setMonthlyTarget(e.target.value)} />
              </div>
            </div>

            <div className={s.fieldGroup}>
              <label>Goal name (optional)</label>
              <input className={s.input} type="text" placeholder="e.g. Europe trip, Emergency fund" value={goalName} onChange={e => setGoalName(e.target.value)} />
            </div>

            <div className={s.fieldGroup}>
              <label>Email</label>
              <input className={s.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div className={s.fieldGroup}>
              <label>Password</label>
              <input className={s.input} type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>

            {error && <div className={s.error}>{error}</div>}

            <button type="submit" className={s.btnPrimary} disabled={loading}>
              {loading ? 'Creating account…' : "Let's go →"}
            </button>
            <div className={s.footerLink}>Already have an account? <Link href="/login">Sign in</Link></div>
          </form>
        )}
      </div>
    </div>
  )
}
