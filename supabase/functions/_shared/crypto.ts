import { getAccessCodePepper, getRateLimitPepper, getVaultEncryptionKey } from './env.ts'

const encoder = new TextEncoder()

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

export function randomBase64(bytes = 16): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
}

export function randomToken(bytes = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToHex(new Uint8Array(digest))
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return bytesToHex(new Uint8Array(signature))
}

export async function accessCodeLookupHash(code: string): Promise<string> {
  return hmac(code, getAccessCodePepper())
}

export async function rateLimitHash(value: string): Promise<string> {
  return hmac(value, getRateLimitPepper())
}

export async function deriveAccessCodeVerifier(code: string, saltBase64: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${code}:${getAccessCodePepper()}`),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltBase64),
      iterations: 600_000,
    },
    material,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1)
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

export function generateAccessCode(): string {
  const modulus = 1_000_000_000_000n
  const maxAccepted = 281_000_000_000_000n
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    let value = 0n
    for (const byte of bytes) value = (value << 8n) | BigInt(byte)
    if (value >= maxAccepted) continue
    return (value % modulus).toString().padStart(12, '0')
  }
}

async function vaultKey(): Promise<CryptoKey> {
  const raw = base64ToBytes(getVaultEncryptionKey())
  if (raw.byteLength !== 32)
    throw new Error('VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes.')
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await vaultKey(),
    encoder.encode(plaintext),
  )
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) }
}

export async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    await vaultKey(),
    base64ToBytes(ciphertext),
  )
  return new TextDecoder().decode(decrypted)
}
