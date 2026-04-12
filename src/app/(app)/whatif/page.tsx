import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WhatIfClient from './WhatIfClient'

export default async function WhatIfPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <WhatIfClient />
}
