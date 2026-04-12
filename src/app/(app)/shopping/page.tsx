import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShoppingClient from './ShoppingClient'

export default async function ShoppingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <ShoppingClient />
}
