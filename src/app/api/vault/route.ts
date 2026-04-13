// Force Node.js runtime so we can use Node's crypto module.
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  encryptNum, decryptNum,
  encryptArr, decryptArr,
  encryptNullableNum, decryptNullableNum,
} from '@/lib/crypto'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function makeSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
}

// ── GET — read encrypted values ────────────────────────────────────────────────
//
// Returns: { income, total_savings, monthly_target, wallet, cycle_income,
//            last_cycle_saved, months }
// Auto-migrates plaintext → encrypted on first access and zeroes the old column.

export async function GET() {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id
  const year = new Date().getFullYear()

  const [
    { data: prof },
    { data: cs },
    { data: ms },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('income, income_enc, total_savings, savings_enc, monthly_target, target_enc')
      .eq('user_id', uid)
      .single(),
    supabase
      .from('cycle_state')
      .select('wallet, wallet_enc, cycle_income, cycle_income_enc, last_cycle_saved, saved_enc')
      .eq('user_id', uid)
      .single(),
    supabase
      .from('monthly_savings')
      .select('months, months_enc')
      .eq('user_id', uid)
      .eq('year', year)
      .single(),
  ])

  if (!prof || !cs) {
    return NextResponse.json({ error: 'No profile data' }, { status: 404 })
  }

  // ── resolve each field (decrypt or auto-migrate) ──────────────────────────

  // profiles.income
  let income = 0
  if (prof.income_enc) {
    income = decryptNum(prof.income_enc)
  } else if ((prof.income ?? 0) !== 0) {
    const enc = encryptNum(prof.income)
    await supabase.from('profiles').update({ income_enc: enc, income: 0 }).eq('user_id', uid)
    income = prof.income
  }

  // profiles.total_savings
  let total_savings = 0
  if (prof.savings_enc) {
    total_savings = decryptNum(prof.savings_enc)
  } else if ((prof.total_savings ?? 0) !== 0) {
    const enc = encryptNum(prof.total_savings)
    await supabase.from('profiles').update({ savings_enc: enc, total_savings: 0 }).eq('user_id', uid)
    total_savings = prof.total_savings
  }

  // profiles.monthly_target
  let monthly_target = 500
  if (prof.target_enc) {
    monthly_target = decryptNum(prof.target_enc)
  } else if ((prof.monthly_target ?? 0) !== 0) {
    const enc = encryptNum(prof.monthly_target)
    await supabase.from('profiles').update({ target_enc: enc, monthly_target: 0 }).eq('user_id', uid)
    monthly_target = prof.monthly_target
  }

  // cycle_state.wallet
  let wallet = 0
  if (cs.wallet_enc) {
    wallet = decryptNum(cs.wallet_enc)
  } else if ((cs.wallet ?? 0) !== 0) {
    const enc = encryptNum(cs.wallet)
    await supabase.from('cycle_state').update({ wallet_enc: enc, wallet: 0 }).eq('user_id', uid)
    wallet = cs.wallet
  }

  // cycle_state.cycle_income
  let cycle_income = 0
  if (cs.cycle_income_enc) {
    cycle_income = decryptNum(cs.cycle_income_enc)
  } else if ((cs.cycle_income ?? 0) !== 0) {
    const enc = encryptNum(cs.cycle_income)
    await supabase.from('cycle_state').update({ cycle_income_enc: enc, cycle_income: 0 }).eq('user_id', uid)
    cycle_income = cs.cycle_income
  }

  // cycle_state.last_cycle_saved (nullable)
  let last_cycle_saved: number | null = null
  if (cs.saved_enc) {
    last_cycle_saved = decryptNullableNum(cs.saved_enc)
  } else if (cs.last_cycle_saved !== null && cs.last_cycle_saved !== undefined) {
    const enc = encryptNullableNum(cs.last_cycle_saved)
    await supabase.from('cycle_state').update({ saved_enc: enc, last_cycle_saved: null }).eq('user_id', uid)
    last_cycle_saved = cs.last_cycle_saved
  }

  // monthly_savings.months
  let months: number[] = new Array(12).fill(0)
  if (ms?.months_enc) {
    months = decryptArr(ms.months_enc)
  } else if (ms?.months && ms.months.some((v: number) => v !== 0)) {
    const enc = encryptArr(ms.months)
    await supabase.from('monthly_savings').update({ months_enc: enc, months: new Array(12).fill(0) }).eq('user_id', uid).eq('year', year)
    months = ms.months
  }

  return NextResponse.json({
    income,
    total_savings,
    monthly_target,
    wallet,
    cycle_income,
    last_cycle_saved,
    months,
  })
}

// ── POST — write encrypted values ──────────────────────────────────────────────
//
// Body (all optional):
//   { income?, total_savings?, monthly_target?, wallet?, cycle_income?,
//     last_cycle_saved?, months? }

export async function POST(request: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id
  const year = new Date().getFullYear()
  const body = await request.json() as {
    income?: number
    total_savings?: number
    monthly_target?: number
    wallet?: number
    cycle_income?: number
    last_cycle_saved?: number | null
    months?: number[]
  }

  // ── profiles ────────────────────────────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {}
  if (body.income !== undefined)         profileUpdate.income_enc  = encryptNum(body.income)
  if (body.total_savings !== undefined)  profileUpdate.savings_enc = encryptNum(body.total_savings)
  if (body.monthly_target !== undefined) profileUpdate.target_enc  = encryptNum(body.monthly_target)

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await supabase.from('profiles').update(profileUpdate).eq('user_id', uid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── cycle_state ─────────────────────────────────────────────────────────────
  const cycleUpdate: Record<string, unknown> = {}
  if (body.wallet !== undefined)           cycleUpdate.wallet_enc       = encryptNum(body.wallet)
  if (body.cycle_income !== undefined)     cycleUpdate.cycle_income_enc = encryptNum(body.cycle_income)
  if ('last_cycle_saved' in body)          cycleUpdate.saved_enc        = encryptNullableNum(body.last_cycle_saved!)

  if (Object.keys(cycleUpdate).length > 0) {
    const { error } = await supabase.from('cycle_state').update(cycleUpdate).eq('user_id', uid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── monthly_savings ─────────────────────────────────────────────────────────
  if (body.months !== undefined) {
    const enc = encryptArr(body.months)
    // Upsert in case the row doesn't exist yet
    const { error } = await supabase.from('monthly_savings').upsert({
      user_id: uid,
      year,
      months: new Array(12).fill(0),
      months_enc: enc,
    }, { onConflict: 'user_id,year' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
