import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MigrateClient from './MigrateClient'

export default async function MigratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <MigrateClient />
}
