// Server-only module — never import this from client components.
// Node.js crypto is not available in the browser bundle.
//
// ENCRYPTION_SECRET must be a 64-character hex string (32 bytes = AES-256).
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Then add to .env.local (no NEXT_PUBLIC_ prefix — keeps it server-only):
//   ENCRYPTION_SECRET=<64-hex-chars>

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGO = 'aes-256-gcm'

function key(): Buffer {
  const hex = process.env.ENCRYPTION_SECRET
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_SECRET must be a 64-character hex string. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hex, 'hex')
}

/** Encrypt a UTF-8 string. Returns "ivB64:tagB64:ciphertextB64". */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

/** Decrypt a value produced by `encrypt`. */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivB64, tagB64, encB64] = parts
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function encryptNum(n: number): string {
  return encrypt(String(n))
}

export function decryptNum(c: string): number {
  return parseFloat(decrypt(c)) || 0
}

export function encryptArr(arr: number[]): string {
  return encrypt(JSON.stringify(arr))
}

export function decryptArr(c: string): number[] {
  try {
    const parsed = JSON.parse(decrypt(c))
    return Array.isArray(parsed) ? parsed : new Array(12).fill(0)
  } catch {
    return new Array(12).fill(0)
  }
}

export function encryptNullableNum(n: number | null): string {
  return encrypt(n === null ? 'null' : String(n))
}

export function decryptNullableNum(c: string): number | null {
  const s = decrypt(c)
  if (s === 'null') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}
