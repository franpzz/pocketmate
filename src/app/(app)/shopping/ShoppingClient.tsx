'use client'

import { useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import s from './shopping.module.css'

interface ShopItem { name: string; qty: string; price: number }

type Diet = 'none' | 'vegetarian' | 'vegan'
type ListState = 'empty' | 'generating' | 'ready'

const DIET_OPTIONS: { value: Diet; label: string }[] = [
  { value: 'none',        label: 'No restrictions' },
  { value: 'vegetarian',  label: 'Vegetarian' },
  { value: 'vegan',       label: 'Vegan' },
]

const FALLBACK_ITEMS: ShopItem[] = [
  { name: 'Free range eggs (12pk)',  qty: '1 × 12pk', price: 5.50 },
  { name: 'Full cream milk',         qty: '2L',        price: 3.20 },
  { name: 'Chicken breast',          qty: '1kg',       price: 12.00 },
  { name: 'Wholemeal bread',         qty: '1 loaf',    price: 3.80 },
  { name: 'Greek yoghurt',           qty: '500g',      price: 4.50 },
  { name: 'Mixed salad leaves',      qty: '120g bag',  price: 3.50 },
  { name: 'Pasta (penne)',           qty: '500g',      price: 2.50 },
  { name: 'Tinned tomatoes',         qty: '3 × 400g',  price: 4.50 },
  { name: 'Frozen peas',             qty: '1kg',       price: 3.50 },
  { name: 'Cheddar cheese',          qty: '500g',      price: 7.00 },
  { name: 'Bananas',                 qty: '1.5kg',     price: 4.00 },
  { name: 'Apples',                  qty: '6 pack',    price: 5.50 },
  { name: 'Oats',                    qty: '1kg',       price: 3.50 },
  { name: 'Olive oil',               qty: '500ml',     price: 7.00 },
  { name: 'Garlic',                  qty: '1 bulb',    price: 0.90 },
]

function dietRestriction(diet: Diet): string {
  if (diet === 'vegetarian') return ' The list must be fully vegetarian — no meat, poultry, or fish. Dairy and eggs are allowed.'
  if (diet === 'vegan')      return ' The list must be fully vegan — absolutely no animal products (no meat, fish, poultry, dairy, eggs, or honey). Use plant-based alternatives where relevant.'
  return ''
}

function parseItems(text: string): ShopItem[] | null {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (i): i is ShopItem =>
        typeof i.name === 'string' &&
        typeof i.qty === 'string' &&
        typeof i.price === 'number',
    )
  } catch {
    return null
  }
}

export default function ShoppingClient() {
  const { profile, loading } = useAppState()
  const [listState, setListState] = useState<ListState>('empty')
  const [diet, setDiet]           = useState<Diet>('none')
  const [items, setItems]         = useState<ShopItem[]>([])
  const [checked, setChecked]     = useState<Set<number>>(new Set())

  if (loading) return null
  const budget = profile?.groceries ?? 120
  const total  = items.reduce((a, i) => a + i.price, 0)

  async function generate() {
    setListState('generating')
    setChecked(new Set())

    try {
      const prompt = `Generate a weekly grocery list for a budget of $${budget}.${dietRestriction(diet)} Return ONLY a JSON array with no explanation or markdown, where each item has "name" (string), "qty" (string), and "price" (number). Include 12–15 items covering a balanced mix of proteins, vegetables, dairy or alternatives, and pantry staples. The total must not exceed $${budget}.`

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', text: prompt }] }),
      })

      const data = await res.json()
      const parsed = res.ok ? parseItems(data.text ?? '') : null
      setItems(parsed && parsed.length > 0 ? parsed : FALLBACK_ITEMS)
    } catch {
      setItems(FALLBACK_ITEMS)
    }

    setListState('ready')
  }

  function toggleCheck(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Shopping list</h1>
        <p className={s.pageSub}>Budget-aware weekly groceries</p>
      </div>

      <div className={s.shopHeader}>
        <div className={s.budgetDisplay}>
          <div className={s.bdLabel}>Weekly grocery budget</div>
          <div className={s.bdVal}>${budget}</div>
        </div>
        <button className={s.genBtn} onClick={generate} disabled={listState === 'generating'}>
          {listState === 'generating' ? '✦ Building…' : '✦ Generate list'}
        </button>
      </div>

      <div className={s.dietRow}>
        {DIET_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`${s.dietBtn} ${diet === opt.value ? s.sel : ''}`}
            onClick={() => setDiet(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {listState === 'empty' && (
        <div className={s.emptyState}>
          Hit &ldquo;Generate list&rdquo; and PocketMate will build a week of groceries within your budget.
        </div>
      )}

      {listState === 'generating' && (
        <div className={s.emptyState}>
          <span className={s.spin}>✦</span>
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>Building your list…</p>
        </div>
      )}

      {listState === 'ready' && (
        <div className={s.shopList}>
          {items.map((item, i) => {
            const done = checked.has(i)
            return (
              <div key={i} className={`${s.shopItem} ${done ? s.done : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className={`${s.check} ${done ? s.checked : ''}`} onClick={() => toggleCheck(i)}>
                  {done ? '✓' : ''}
                </div>
                <span className={s.shopName}>{item.name}</span>
                <span className={s.shopQty}>{item.qty}</span>
                <span className={s.shopPrice}>${item.price.toFixed(2)}</span>
              </div>
            )
          })}
          <div className={s.shopTotal}>
            <span>Total estimate</span>
            <span className={s.totalVal}>${total.toFixed(2)} / ${budget}</span>
          </div>
        </div>
      )}
    </div>
  )
}
