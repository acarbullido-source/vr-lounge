#!/usr/bin/env node
/**
 * Generates a salted PBKDF2-HMAC-SHA256 (120,000 iterations) verifier hash
 * for rotating the VR Lounge passcode without ever storing plaintext in code or CI.
 *
 * Usage:
 *   npm run hash-passcode -- "YOUR_NEW_PASSCODE"
 */

const rawPasscode = process.argv[2]?.trim()
const salt = process.argv[3]?.trim() || 'vr-lounge-auth-v2'

if (!rawPasscode) {
  console.error('Usage: npm run hash-passcode -- "<new-passcode>" [optional-salt]')
  process.exit(1)
}

const normalized = rawPasscode.toUpperCase()
const enc = new TextEncoder()

const keyMaterial = await globalThis.crypto.subtle.importKey(
  'raw',
  enc.encode(normalized),
  'PBKDF2',
  false,
  ['deriveBits'],
)

const verifierBits = await globalThis.crypto.subtle.deriveBits(
  {
    name: 'PBKDF2',
    salt: enc.encode(`${salt}:verifier`),
    iterations: 120_000,
    hash: 'SHA-256',
  },
  keyMaterial,
  256,
)

const verifierHex = Buffer.from(verifierBits).toString('hex')

console.log('\n=== VR Lounge PBKDF2-SHA256 Passcode Verifier ===')
console.log(`VITE_LOUNGE_PASSCODE_SALT=${salt}`)
console.log(`VITE_LOUNGE_PASSCODE_VERIFIER=${verifierHex}\n`)
