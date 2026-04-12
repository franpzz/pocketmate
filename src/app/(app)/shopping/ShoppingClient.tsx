'use client'

import { useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import s from './shopping.module.css'

const SHOP_ITEMS = [
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

type ListState = 'empty' | 'generating' | 'ready'

export default function ShoppingClient() {
  const { profile, loading } = useAppState()
  const [listState, setListState] = useState<ListState>('empty')
  const [checked, setChecked] = useState<Set<number>>(new Set())

  if (loading) return null
  const budget = profile?.groceries ?? 120
  const total = SHOP_ITEMS.reduce((a, i) => a + i.price, 0)

  function generate() {
    setListState('generating')
    setChecked(new Set())
    setTimeout(() => setListState('ready'), 1200)
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
          {SHOP_ITEMS.map((item, i) => {
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
