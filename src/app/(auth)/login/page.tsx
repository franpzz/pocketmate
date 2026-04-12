'use client'

import { useState } from 'react'
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className={s.screen}>
      <div className={s.card}>
        <div className={s.logo}>PocketMate</div>
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

        <div className={s.footerLink}>
          No account? <Link href="/signup">Create one</Link>
        </div>
      </div>
    </div>
  )
}
