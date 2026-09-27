# Sylc

Sylc is a browser-based AI chat app. The live site is [Sylc on GitHub Pages](https://c-a-studios-viji.github.io/Sylc/).

## Use

1. Open **Models**.
2. Paste and connect the required **Live info** key.
3. Paste a key into **Medalion** or **YiNi** and select **Connect**.
4. Sylc checks the key, loads available models, and selects **Zen** by default for Medalion or **Kami** for YiNi. **Strato** and **Zex** are the second choices.
5. Open **Chat** and send a message. Switch models from the selector without losing the current conversation.

Keys are kept in the browser tab's session storage and sent directly to the selected AI service. Remove a key from Models to clear it. Chat history stays in memory and disappears on reload. There is no account or cross-device restoration in this version. Use a private device and avoid installing untrusted browser extensions.

Model aliases come from the connected account's live model catalogue. The ranking is a heuristic based on model name, context length, and recency; availability and ordering can change. Actual API usage may incur charges under your AI account.

Live info is required for every chat reply. Sylc checks current web sources before it answers, including questions about the current day or date. If verification is unavailable, it does not send an unverified reply. Live information requests may consume credits under that account.

## Develop

```bash
npm install
npm run dev
```

The app uses React, TypeScript, Vite, and Tailwind CSS. It needs no environment variables or hosted backend.

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

Browser tests mock the external AI endpoints. A live request needs your own valid key. The Pages workflow builds the Vite app with the `/Sylc/` base path and publishes `dist/`.
