# Sylc

Sylc is a secure multi-provider AI chat application for **OpenRouter** and **Mistral**. It combines live model discovery and streaming chat with a portable profile vault: a user can restore the same Sylc profile on another device using a 12-digit access code without exposing saved provider API keys to that device.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, Zod, Supabase Postgres + Edge Functions, Web Crypto, Vitest/Testing Library, Playwright, and pgTAP database tests.

## Security at a glance

- Saved provider keys are AES-256-GCM encrypted at rest with a server-only key.
- Saved keys never return to the browser and the browser never calls OpenRouter/Mistral directly with them.
- The 12-digit access code is never stored plaintext. The database stores a keyed lookup hash plus a salted, peppered slow verifier.
- Access-code attempts are rate-limited atomically per IP hash and code hash.
- Profile-session tokens are random, expire after 24 hours, and are stored only as SHA-256 hashes server-side.
- All application tables have RLS enabled; direct `anon`/`authenticated` table access is denied and revoked.

See [`docs/SECURITY.md`](docs/SECURITY.md) for the threat model and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for system design.

## Local setup

### Prerequisites

- Node.js 22+
- Docker
- Supabase CLI
- Deno (for direct Edge Function type checks/tests)

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Start the local Supabase stack

```bash
supabase start
supabase db reset
```

`db reset` rebuilds the local database from `supabase/migrations` and verifies that the migration chain is reproducible.

### 3. Configure local Edge secrets

Create `supabase/functions/.env` (it is gitignored):

```env
VAULT_ENCRYPTION_KEY=<base64 of exactly 32 random bytes>
ACCESS_CODE_PEPPER=<long random secret>
RATE_LIMIT_PEPPER=<different long random secret>
ALLOWED_ORIGINS=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
```

Generate suitable values, for example:

```bash
openssl rand -base64 32
openssl rand -hex 32
openssl rand -hex 32
```

Never prefix these values with `VITE_`.

### 4. Add browser-safe Supabase values

Copy the local URL and publishable key printed by `supabase start` into `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
```

### 5. Serve Edge Functions and the app

```bash
supabase functions serve --env-file supabase/functions/.env
npm run dev
```

Open the Vite URL. The first screen is the usable Sylc profile flow, not a marketing landing page.

## Tests and quality gates

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
npm run test:edge
npm run security:db
```

- `test`: React/unit + static security-invariant tests.
- `e2e`: Playwright core UI flows using provider/backend test doubles; production provider code remains real.
- `test:edge`: Deno tests for access-code and credential cryptography.
- `security:db`: pgTAP assertions against a running local Supabase database.

Live provider validation/streaming checks require real OpenRouter and Mistral keys and are intentionally not stored in CI.

## Hosted Supabase deployment

1. Create or choose a Supabase project.
2. Link the repo:

```bash
supabase link --project-ref <project-ref>
supabase db push --dry-run
supabase db push
```

3. Set Edge Function secrets:

```bash
supabase secrets set \
  VAULT_ENCRYPTION_KEY='...' \
  ACCESS_CODE_PEPPER='...' \
  RATE_LIMIT_PEPPER='...' \
  ALLOWED_ORIGINS='https://your-sylc-domain.example' \
  PUBLIC_APP_URL='https://your-sylc-domain.example'
```

4. Deploy all functions:

```bash
supabase functions deploy
```

5. Set the frontend deployment environment to the hosted project URL and **publishable** key only:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

6. Build/deploy the Vite `dist/` directory. Configure SPA fallback routing to `index.html`.

## Provider behavior

### OpenRouter

Sylc validates a user key server-side, loads the live OpenRouter model catalogue, normalizes context/pricing/capability metadata, and streams chat through the Edge Function. The user can also enter a model ID manually.

### Mistral

Sylc loads only models returned by the connected Mistral account, streams chat server-side, and exposes reasoning-effort controls. Unsupported settings are reported cleanly instead of silently pretending a capability exists.

Featured model groups are calculated from the live provider response at request time; the source contains no hardcoded claim that an old model is still the flagship.

## Project structure

```text
src/                          React app
supabase/migrations/          Postgres schema, RLS, rate limiting
supabase/functions/_shared/   crypto/auth/provider/server helpers
supabase/functions/profile/   profile vault API
supabase/functions/providers/ provider key + model API
supabase/functions/chat/      streaming chat proxy + persistence
supabase/functions/conversations/ conversation CRUD
supabase/tests/               pgTAP database tests
supabase/functions/tests/     Deno crypto tests
e2e/                          Playwright flows
docs/                         architecture + security model
```

## Troubleshooting

**“Sylc is not configured yet.”** Set both browser-safe `VITE_SUPABASE_*` variables and restart Vite.

**Edge Function returns `SESSION_INVALID`.** The local session is missing, expired, or revoked. Restore the profile again with its access code.

**`PROVIDER_NOT_CONNECTED`.** Add the provider key in Settings → Providers. The stored key will remain masked after save.

**`ACCESS_CODE_LOCKED`.** Too many recovery attempts were made for the code or source IP. Wait for the 15-minute window rather than retrying repeatedly.

**Model catalogue fails.** Test the saved provider key, verify account credit/access, and retry. Sylc does not fall back to invented model IDs.

**`supabase db reset` fails.** Fix the reported migration error and rerun the reset. Do not edit a production database manually to work around a failed migration.

**CORS origin rejected.** Add the exact frontend origin to the comma-separated `ALLOWED_ORIGINS` Edge secret.

## Production checklist

Before a real launch: run all CI gates, configure a hosted Supabase project, set unique production secrets, use HTTPS, set the exact production origin allowlist, live-test both provider keys/model catalogues/streams, review Supabase security/performance advisors, verify no secrets are present in the client bundle or deployment logs, and keep database backups enabled.
