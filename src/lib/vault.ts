// Client-side helpers for reading and writing encrypted values via /api/vault.
// These make fetch calls to the Next.js API route — the encryption key never
// leaves the server.

export interface VaultData {
  income: number
  total_savings: number
  monthly_target: number
  wallet: number
  cycle_income: number
  last_cycle_saved: number | null
  months: number[]
}

export async function readVault(): Promise<VaultData> {
  const res = await fetch('/api/vault')
  if (!res.ok) {
    // Fall back to safe defaults so the UI doesn't break
    return {
      income: 0,
      total_savings: 0,
      monthly_target: 500,
      wallet: 0,
      cycle_income: 0,
      last_cycle_saved: null,
      months: new Array(12).fill(0),
    }
  }
  return res.json()
}

export async function writeVault(data: Partial<VaultData>): Promise<void> {
  const res = await fetch('/api/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Vault write failed')
  }
}
