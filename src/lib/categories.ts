import type { CustomCategory } from './types'

export interface CatDef {
  bar: string
  dot: string
  tc: string
  bg?: string
}

export const CAT_DEFS: Record<string, CatDef> = {
  'Housing':      { bar: 'rgba(99,179,237,0.35)',   dot: 'rgba(99,179,237,0.7)',   tc: 'var(--blue)' },
  'Utilities':    { bar: 'rgba(154,117,234,0.35)',  dot: 'rgba(154,117,234,0.7)',  tc: '#9b7ee8' },
  'Transport':    { bar: 'rgba(245,197,66,0.3)',    dot: 'rgba(245,197,66,0.7)',   tc: 'var(--amber)' },
  'Groceries':    { bar: 'rgba(255,107,107,0.3)',   dot: 'rgba(255,107,107,0.7)',  tc: 'var(--red)' },
  'Dining':       { bar: 'rgba(14,112,104,0.3)',    dot: 'rgba(14,112,104,0.7)',   tc: 'var(--teal)' },
  'Health':       { bar: 'rgba(82,217,192,0.3)',    dot: 'rgba(82,217,192,0.7)',   tc: 'var(--teal)' },
  'Entertainment':{ bar: 'rgba(180,100,220,0.28)',  dot: 'rgba(180,100,220,0.7)',  tc: '#c06add' },
  'Other':        { bar: 'rgba(160,160,150,0.3)',   dot: 'rgba(160,160,150,0.7)',  tc: 'var(--text3)' },
}

export const CUSTOM_CAT_COLORS: Required<CatDef>[] = [
  { bar: 'rgba(180,100,220,0.3)', dot: 'rgba(180,100,220,0.7)', tc: '#c06add', bg: 'rgba(180,100,220,0.12)' },
  { bar: 'rgba(100,200,140,0.3)', dot: 'rgba(100,200,140,0.7)', tc: '#40c870', bg: 'rgba(100,200,140,0.12)' },
  { bar: 'rgba(240,140,60,0.3)',  dot: 'rgba(240,140,60,0.7)',  tc: '#f08030', bg: 'rgba(240,140,60,0.12)' },
  { bar: 'rgba(80,160,240,0.3)',  dot: 'rgba(80,160,240,0.7)',  tc: '#3a9ef0', bg: 'rgba(80,160,240,0.12)' },
  { bar: 'rgba(220,80,120,0.3)',  dot: 'rgba(220,80,120,0.7)',  tc: '#dc5080', bg: 'rgba(220,80,120,0.12)' },
]

export const CAT_NAMES = Object.keys(CAT_DEFS)

export const catIconMap: Record<string, string> = {
  'Housing':      '🏠',
  'Utilities':    '💡',
  'Transport':    '🚌',
  'Groceries':    '🛒',
  'Dining':       '🍽',
  'Health':       '💊',
  'Entertainment':'🎬',
  'Other':        '📦',
}

export const catBgMap: Record<string, string> = {
  'Housing':      'var(--blue-dim)',
  'Utilities':    'rgba(154,117,234,0.12)',
  'Transport':    'var(--amber-dim)',
  'Groceries':    'var(--red-dim)',
  'Dining':       'var(--teal-dim)',
  'Health':       'var(--teal-dim)',
  'Entertainment':'rgba(180,100,220,0.12)',
  'Other':        'var(--surface2)',
}

export function getAllCatNames(customCats: CustomCategory[]): string[] {
  return [...CAT_NAMES, ...customCats.map(c => c.name)]
}

export function getCatDef(name: string, customCats: CustomCategory[]): CatDef {
  if (CAT_DEFS[name]) return CAT_DEFS[name]
  const i = customCats.findIndex(c => c.name === name)
  return i >= 0 ? CUSTOM_CAT_COLORS[i % CUSTOM_CAT_COLORS.length] : CAT_DEFS['Other']
}

export function getCatIcon(name: string, customCats: CustomCategory[]): string {
  if (catIconMap[name]) return catIconMap[name]
  const c = customCats.find(c => c.name === name)
  return c ? c.icon : '📦'
}

export function getCatBg(name: string, customCats: CustomCategory[]): string {
  if (catBgMap[name]) return catBgMap[name]
  const i = customCats.findIndex(c => c.name === name)
  return i >= 0 ? CUSTOM_CAT_COLORS[i % CUSTOM_CAT_COLORS.length].bg : 'var(--surface2)'
}
