import { assert, assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1.0.14'
import {
  accessCodeLookupHash,
  decryptSecret,
  deriveAccessCodeVerifier,
  encryptSecret,
  generateAccessCode,
  randomBase64,
} from '../_shared/crypto.ts'

const keyBytes = new Uint8Array(32).fill(17)
Deno.env.set('VAULT_ENCRYPTION_KEY', btoa(String.fromCharCode(...keyBytes)))
Deno.env.set('ACCESS_CODE_PEPPER', 'test-access-pepper-that-is-long-and-private')
Deno.env.set('RATE_LIMIT_PEPPER', 'test-rate-pepper-that-is-different-and-private')

Deno.test('access codes are always zero-padded 12 digit strings', () => {
  for (let index = 0; index < 100; index += 1) assertMatch(generateAccessCode(), /^\d{12}$/)
})

Deno.test('lookup and verifier never equal the plaintext access code', async () => {
  const code = '000123456789'
  const salt = randomBase64(16)
  const lookup = await accessCodeLookupHash(code)
  const verifier = await deriveAccessCodeVerifier(code, salt)
  assertEquals(lookup.length, 64)
  assertEquals(verifier.length, 64)
  assertNotEquals(lookup, code)
  assertNotEquals(verifier, code)
  assertNotEquals(lookup, verifier)
})

Deno.test('provider secrets round-trip through AES-GCM without plaintext storage', async () => {
  const secret = 'sk-test-provider-secret-never-store-me'
  const encrypted = await encryptSecret(secret)
  assert(encrypted.ciphertext.length > secret.length)
  assertNotEquals(encrypted.ciphertext, secret)
  assertEquals(await decryptSecret(encrypted.ciphertext, encrypted.iv), secret)
})
