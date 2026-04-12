import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogClient from './LogClient'

export default async function LogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <LogClient />
}
