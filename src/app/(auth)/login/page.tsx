'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import s from '../auth.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'confirmation_failed') {
      setError('Email confirmation failed. The link may have expired — please sign up again.')
    }
  }, [])

  function tryGuest() {
    // Set a 7-day cookie (pm_guest=1) so the proxy lets them through
    document.cookie = 'pm_guest=1; path=/; max-age=604800'
    // Seed default guest data so the dashboard has something to show
    const defaults = {
      name: 'Guest', income: 2000, cadence: 'weekly', extra: 0,
      groceries: 120, dining: 80, transport: 80, entertainment: 20,
      monthly_target: 500, goal_name: 'Savings goal', total_savings: 0,
      wallet: 0, cycle_income: 0, has_first_pay: false,
      last_paid_date: null, last_cycle_saved: null,
      cycle_spending: {}, months: new Array(12).fill(0),
      fixed: [], transactions: [], customCats: [],
    }
    localStorage.setItem('pm_guest_data', JSON.stringify(defaults))
    router.push('/dashboard')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      // Generic message — don't reveal whether the email exists
      setError('Incorrect email or password. Please try again.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className={s.screen}>
      <div className={s.card}>
        <img src="/Logo.png" alt="PocketMate" style={{ width: 350, display: 'block', margin: '0 auto 8px' }} />
        <h1 className={s.title}>Welcome back.</h1>
        <p className={s.sub}>Sign in to your account to continue.</p>

        <form onSubmit={handleSubmit}>
          <div className={s.fieldGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={s.input}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className={s.fieldGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={s.input}
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className={s.error}>{error}</div>}

          <button type="submit" className={s.btnPrimary} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <button
          type="button"
          onClick={tryGuest}
          className={s.btnPrimary}
          style={{ marginTop: 8, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)' }}
        >
          Try it out (no account needed) →
        </button>

        <div className={s.footerLink}>
          No account? <Link href="/signup">Create one</Link>
        </div>
      </div>
    </div>
  )
}
