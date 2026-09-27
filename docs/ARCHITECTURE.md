# Sylc architecture

## Request flow

```text
React/Vite browser
  |  publishable Supabase key + x-sylc-session
  v
Supabase Edge Functions
  |-- profile         profile vault, recovery, preferences, sessions
  |-- providers       key validation/storage, live model catalogues
  |-- conversations   history CRUD
  `-- chat            credential unwrap, provider streaming, persistence
           |
           +--> OpenRouter API
           `--> Mistral API

Edge Functions <--> Supabase Postgres
                  encrypted credentials / hashes / chat data
```

The browser never sends a stored provider key to an AI provider. OpenRouter and Mistral calls are always proxied through `providers` or `chat`.

## Database

- `profiles`: profile identity and lifecycle.
- `profile_access_codes`: HMAC lookup hash, slow verifier, random salt, rotation timestamps.
- `provider_credentials`: AES-GCM ciphertext + IV and validation metadata.
- `profile_preferences`: selected provider/model and generation defaults.
- `profile_sessions`: SHA-256 session-token hashes, expiry, revocation, device label.
- `conversations` / `messages`: durable provider-independent chat history.
- `rate_limit_events`: hashed abuse identifiers and attempt audit data.

All IDs are UUIDs except the rate-limit audit identity. Foreign keys cascade from `profiles`, so permanent profile deletion also removes the encrypted vault, sessions, preferences, conversations, and messages.

## Provider abstraction

`supabase/functions/_shared/providers.ts` owns provider-specific URLs, key validation, model normalization, error mapping, and streaming request construction. Model IDs are never invented or hardcoded into the product UI. A provider's live `/models` result is normalized and scored into useful featured groups while the full catalogue remains searchable. Manual model IDs cover newly released models that the connected account can use before catalogue metadata catches up.

## Streaming and persistence

The `chat` function loads history from Postgres, decrypts the selected provider credential, then starts the provider stream. Provider-specific SSE chunks are normalized to an OpenAI-shaped `delta.content` stream for the browser. Only the final answer text is persisted after the upstream stream completes successfully. Stop/cancel aborts the upstream request and avoids persisting a partial assistant message.

Edit/resend deletes the target user message and all later messages before inserting the edited version. Regenerate removes the selected assistant message and anything after it. This keeps the database conversation tree linear for v1.

## Frontend state

TanStack Query owns server state and cache invalidation. The local browser stores only `{ profileId, token }` for the current Sylc session. Provider keys and recovery codes are deliberately absent from local storage. React Router supplies direct routes for chat, model browser, provider settings, profile security, and sessions.

## Future-safe seams

The provider module, credential table, and chat request are typed around the two v1 providers only. Adding another provider should be an explicit schema/type change rather than an unbounded string. The current linear conversation history can later gain branches by adding parent-message relationships without changing the credential boundary.
