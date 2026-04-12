import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WhatIfPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, letterSpacing: '-0.5px', marginBottom: 4 }}>What-if</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Explore budget scenarios</p>
      </div>
      <div style={{ padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, color: 'var(--text3)', fontSize: 13, display: 'inline-block' }}>
        What-if calculator coming in Phase 5 ✦
      </div>
    </div>
  )
}
