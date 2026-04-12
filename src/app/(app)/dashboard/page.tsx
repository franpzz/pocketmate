import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--accent)' }}>
        PocketMate
      </div>
      <div style={{ color: 'var(--text2)', fontSize: '14px' }}>
        Signed in as {user.email}
      </div>
      <div style={{
        marginTop: '8px',
        padding: '12px 20px',
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: '12px',
        color: 'var(--text3)',
        fontSize: '13px',
      }}>
        Dashboard coming in Phase 3 ✦
      </div>
    </div>
  )
}
