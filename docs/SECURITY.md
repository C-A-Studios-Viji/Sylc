# Sylc security model

Sylc treats a profile access code like a password and provider API keys like vault secrets. The browser is intentionally not trusted with saved provider credentials.

## Trust boundaries

- **Browser:** receives a short-lived Sylc profile-session token and masked connection status. It never receives a saved OpenRouter or Mistral key.
- **Supabase Edge Functions:** the only application layer allowed to decrypt provider credentials or call provider APIs with saved keys.
- **Postgres:** stores only encrypted provider credentials, hashed profile-session tokens, and non-reversible access-code material.
- **Edge Function secrets:** hold the 256-bit vault encryption key and independent peppers. They must never be `VITE_*` variables or committed.

## Access-code design

A 12-digit numeric code has limited entropy (about 40 bits), so Sylc uses layered controls:

1. The code is generated with Web Crypto and zero-padded to exactly 12 digits.
2. `lookup_hash` is HMAC-SHA-256(code, `ACCESS_CODE_PEPPER`) so the database cannot be used to enumerate codes without the server secret.
3. `verifier_hash` is PBKDF2-SHA-256 with a per-profile random salt, a server pepper, and 600,000 iterations. The plaintext code is never inserted into Postgres.
4. Restore attempts consume an atomic Postgres rate-limit slot. An advisory transaction lock prevents parallel count/insert races. The current policy permits five attempts per 15 minutes per IP hash and per code hash.
5. A successful restore creates a fresh random 256-bit session token. Only its SHA-256 hash is stored; the session expires after 24 hours and can be revoked.
6. Regenerating the code replaces the old lookup/verifier atomically, making the old code unusable.

PBKDF2 is used because it is supported directly by the Edge Runtime Web Crypto implementation. If a future runtime provides a well-maintained native Argon2id or scrypt primitive, it is a reasonable hardening upgrade.

## Provider credential vault

- Provider keys are validated server-side before saving.
- Keys are encrypted using AES-256-GCM with a random 96-bit IV and a server-only `VAULT_ENCRYPTION_KEY`.
- The database schema has no plaintext API-key column.
- Reads used to build the public profile intentionally select only provider/status/timestamp metadata.
- The `providers` and `chat` Edge Functions decrypt a key only immediately before a provider request.
- Provider response bodies and credentials are never logged by application code and are never included in Sylc error payloads.
- Removing a provider deletes its encrypted credential row.

## Database access

All application tables enable Row Level Security. `anon` and `authenticated` receive explicit deny policies and have table privileges revoked. The browser never queries these tables directly. Edge Functions use the server secret key and perform profile authorization through the custom short-lived Sylc session before data access.

## Threat assumptions and limitations

Sylc assumes TLS is enforced between browser, Supabase, and AI providers; Supabase project secrets and the service/secret key remain private; and the project database/Edge runtime administrator is trusted. A successful XSS attack in the Sylc origin may steal the current profile-session token, although it still cannot retrieve saved provider keys. Rate limiting materially reduces code guessing but cannot turn a numeric 12-digit code into a high-entropy password. Rotate the access code after suspected disclosure and revoke unknown sessions.

The current database-backed rate limiter is correct across concurrent Edge workers, but high-volume deployments may move ephemeral counters to a dedicated distributed rate-limit service while retaining the database audit trail.

## Secret rotation

Rotating `VAULT_ENCRYPTION_KEY` requires decrypting and re-encrypting existing provider credentials before retiring the old key. `ACCESS_CODE_PEPPER` rotation similarly requires a controlled migration because lookup hashes depend on it. Do not casually replace either secret on a live database.

## Security verification

Run:

```bash
npm run test
npm run security:db
npm run test:edge
```

CI also checks that no plaintext credential columns are present, RLS remains enabled, browser roles have no direct table grants, rate limiting remains atomic, and Edge Function sources contain no application logging calls.
