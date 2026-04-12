import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AskClient from './AskClient'

export default async function AskPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AskClient />
}
