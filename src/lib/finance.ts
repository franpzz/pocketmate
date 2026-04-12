import type { Cadence, FixedExpense } from './types'

export const mul = (cadence: Cadence): number =>
  cadence === 'weekly' ? 4.33 : cadence === 'fortnightly' ? 2.165 : 1

export const monthlyIncome = (income: number, cadence: Cadence, extra: number): number =>
  Math.round(income * mul(cadence) + extra)

export const fixedTotal = (fixed: Pick<FixedExpense, 'amount' | 'split'>[]): number =>
  fixed.reduce((a, e) => a + e.amount / (e.split || 1), 0)

export const grocM = (groceries: number): number => Math.round(groceries * 4.33)
export const diningM = (dining: number): number => Math.round(dining * 4.33)
export const transM = (transport: number): number => Math.round(transport * 4.33)
export const entM = (entertainment: number): number => Math.round(entertainment * 4.33)

export const totalOut = (
  fixed: Pick<FixedExpense, 'amount' | 'split'>[],
  groceries: number,
  dining: number,
  transport: number,
  entertainment: number,
): number => fixedTotal(fixed) + grocM(groceries) + diningM(dining) + transM(transport) + entM(entertainment)

export const leftover = (
  income: number,
  cadence: Cadence,
  extra: number,
  fixed: Pick<FixedExpense, 'amount' | 'split'>[],
  groceries: number,
  dining: number,
  transport: number,
  entertainment: number,
): number => monthlyIncome(income, cadence, extra) - totalOut(fixed, groceries, dining, transport, entertainment)

export const cycleLeftover = (
  income: number,
  cadence: Cadence,
  extra: number,
  fixed: Pick<FixedExpense, 'amount' | 'split'>[],
  groceries: number,
  dining: number,
  transport: number,
  entertainment: number,
): number => Math.max(0, Math.round(leftover(income, cadence, extra, fixed, groceries, dining, transport, entertainment) / mul(cadence)))

export const cycleLabel = (cadence: Cadence): string =>
  cadence === 'weekly' ? 'week' : cadence === 'fortnightly' ? 'fortnight' : 'month'

export const ytd = (months: number[]): number => months.reduce((a, v) => a + v, 0)

export const currentMonth = (): number => new Date().getMonth()
