import { expect, test, type Page, type Route } from '@playwright/test'

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Test Sylc',
  createdAt: '2026-09-27T09:00:00.000Z',
  providers: [
    { provider: 'openrouter', connected: true, status: 'valid' },
    { provider: 'mistral', connected: true, status: 'valid' },
  ],
  preferences: {
    selectedProvider: 'openrouter',
    selectedModelOpenrouter: 'test/openrouter-model',
    selectedModelMistral: 'test-mistral-model',
    theme: 'light',
    temperature: 0.7,
    maxTokens: 4096,
  },
}

function json(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers,
  })
}

async function installApiMock(page: Page) {
  const conversations: Array<Record<string, unknown>> = []
  const messages = new Map<string, Array<Record<string, unknown>>>()
  let currentProfile = structuredClone(profile)

  await page.route('https://sylc.local/functions/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const fn = url.pathname.split('/').pop()
    const body = route.request().postDataJSON() as Record<string, unknown>

    if (fn === 'profile') {
      if (body.action === 'create')
        return json(
          route,
          {
            profile: currentProfile,
            accessCode: '004200314159',
            sessionToken: 'session-token-that-is-long-enough-for-sylc',
          },
          201,
        )
      if (body.action === 'restore') {
        if (body.code === '999999999999')
          return json(
            route,
            { error: { code: 'ACCESS_CODE_INVALID', message: 'That access code is not valid.' } },
            401,
          )
        return json(route, {
          profile: currentProfile,
          sessionToken: 'restored-session-token-that-is-long-enough',
        })
      }
      if (body.action === 'get') return json(route, { profile: currentProfile })
      if (body.action === 'preferences') {
        currentProfile = {
          ...currentProfile,
          preferences: {
            ...currentProfile.preferences,
            ...(body.selectedProvider ? { selectedProvider: body.selectedProvider } : {}),
            ...(body.selectedModel && body.selectedProvider === 'mistral'
              ? { selectedModelMistral: body.selectedModel }
              : {}),
            ...(body.selectedModel && body.selectedProvider !== 'mistral'
              ? { selectedModelOpenrouter: body.selectedModel }
              : {}),
          },
        }
        return json(route, { profile: currentProfile })
      }
      if (body.action === 'sessions')
        return json(route, {
          sessions: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              deviceLabel: 'Test Browser',
              createdAt: '2026-09-27T09:00:00Z',
              expiresAt: '2026-09-28T09:00:00Z',
              lastSeenAt: '2026-09-27T09:00:00Z',
              current: true,
            },
            {
              id: '33333333-3333-4333-8333-333333333333',
              deviceLabel: 'Other Device',
              createdAt: '2026-09-27T08:00:00Z',
              expiresAt: '2026-09-28T08:00:00Z',
              lastSeenAt: '2026-09-27T08:00:00Z',
              current: false,
            },
          ],
        })
      if (body.action === 'revoke-session' || body.action === 'delete-profile')
        return json(route, { ok: true })
      if (body.action === 'regenerate-code') return json(route, { accessCode: '777700001234' })
      if (body.action === 'rename')
        return json(route, { profile: { ...currentProfile, displayName: body.name } })
    }

    if (fn === 'providers') {
      if (body.action === 'test') return json(route, { ok: true })
      if (body.action === 'save' || body.action === 'remove')
        return json(route, { profile: currentProfile })
      if (body.action === 'models') {
        const provider = body.provider as string
        const model = provider === 'openrouter' ? 'test/openrouter-model' : 'test-mistral-model'
        return json(route, {
          provider,
          models: [
            {
              id: model,
              name: `${provider} flagship`,
              description: 'test',
              contextLength: 128000,
              pricing: null,
              capabilities: ['completion_chat'],
              created: 1780000000,
            },
          ],
          featured: {
            best_overall: [model],
            best_reasoning: [model],
            best_coding: [model],
            fastest: [model],
            best_value: [model],
            long_context: [model],
          },
        })
      }
    }

    if (fn === 'conversations') {
      if (body.action === 'list') return json(route, { conversations })
      if (body.action === 'get') {
        const conversation = conversations.find((item) => item.id === body.conversationId)
        if (!conversation)
          return json(
            route,
            { error: { code: 'CONVERSATION_NOT_FOUND', message: 'Not found' } },
            404,
          )
        return json(route, {
          conversation,
          messages: messages.get(String(body.conversationId)) ?? [],
        })
      }
      if (body.action === 'rename' || body.action === 'delete') return json(route, { ok: true })
    }

    if (fn === 'chat') {
      const id = String(body.conversationId ?? '44444444-4444-4444-8444-444444444444')
      if (!conversations.some((item) => item.id === id))
        conversations.unshift({
          id,
          title: String(body.message || 'Conversation'),
          provider: body.provider,
          modelId: body.modelId,
          createdAt: '2026-09-27T09:00:00Z',
          updatedAt: '2026-09-27T09:00:00Z',
        })
      const existing = messages.get(id) ?? []
      if (body.message)
        existing.push({
          id: '55555555-5555-4555-8555-555555555555',
          conversationId: id,
          role: 'user',
          content: body.message,
          provider: body.provider,
          modelId: body.modelId,
          createdAt: '2026-09-27T09:00:00Z',
        })
      existing.push({
        id: '66666666-6666-4666-8666-666666666666',
        conversationId: id,
        role: 'assistant',
        content: 'Hello from streamed Sylc.',
        provider: body.provider,
        modelId: body.modelId,
        createdAt: '2026-09-27T09:00:01Z',
      })
      messages.set(id, existing)
      const stream =
        'data: {"choices":[{"delta":{"content":"Hello from "}}]}\n\ndata: {"choices":[{"delta":{"content":"streamed Sylc."}}]}\n\ndata: [DONE]\n\n'
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: stream,
        headers: {
          'x-sylc-conversation-id': id,
          'access-control-expose-headers': 'x-sylc-conversation-id',
        },
      })
    }

    return json(
      route,
      { error: { code: 'UNHANDLED_TEST_ROUTE', message: `${fn}:${String(body.action)}` } },
      500,
    )
  })
}

test('creates a profile, displays a 12-digit code once, and chats with persisted history', async ({
  page,
}) => {
  await installApiMock(page)
  await page.goto('/welcome')
  await page.getByPlaceholder('e.g. My Sylc').fill('Test Sylc')
  await page.getByRole('button', { name: 'Create secure profile' }).click()
  await expect(page.getByText('0042 0031 4159')).toBeVisible()
  await expect(page.getByText(/Losing it may make the profile unrecoverable/i)).toBeVisible()
  await page.getByRole('button', { name: /I saved my code/i }).click()
  await expect(page).toHaveURL(/\/chat$/)

  await page.getByPlaceholder('Message Sylc…').fill('Hello')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Hello from streamed Sylc.')).toBeVisible()
  await expect(page).toHaveURL(/\/chat\/44444444-4444-4444-8444-444444444444/)
  await page.reload()
  await expect(page.getByText('Hello from streamed Sylc.')).toBeVisible()
})

test('rejects an invalid access code and restores a valid profile', async ({ page }) => {
  await installApiMock(page)
  await page.goto('/welcome')
  await page.getByRole('button', { name: 'Enter access code' }).click()
  const input = page.getByPlaceholder('0000 0000 0000')
  await input.fill('999999999999')
  await page.getByRole('button', { name: 'Restore profile' }).click()
  await expect(page.getByText('That access code is not valid.')).toBeVisible()
  await input.fill('004200314159')
  await page.getByRole('button', { name: 'Restore profile' }).click()
  await expect(page).toHaveURL(/\/chat$/)
})

test('loads both provider catalogues, tests keys, switches provider, and revokes a session', async ({
  page,
}) => {
  await installApiMock(page)
  await page.goto('/welcome')
  await page.getByRole('button', { name: 'Enter access code' }).click()
  await page.getByPlaceholder('0000 0000 0000').fill('004200314159')
  await page.getByRole('button', { name: 'Restore profile' }).click()

  await page.goto('/settings/providers')
  const keyInputs = page.locator('input[type="password"]')
  await keyInputs.nth(0).fill('sk-openrouter-test')
  await page.getByRole('button', { name: 'Test' }).nth(0).click()
  await expect(page.getByText('OpenRouter accepted this key.')).toBeVisible()
  await keyInputs.nth(1).fill('mistral-test-key')
  await page.getByRole('button', { name: 'Test' }).nth(1).click()
  await expect(page.getByText('Mistral accepted this key.')).toBeVisible()

  await page.goto('/models')
  await expect(page.getByText('openrouter flagship').first()).toBeVisible()
  await page.getByRole('button', { name: 'Mistral' }).click()
  await expect(page.getByText('mistral flagship').first()).toBeVisible()

  await page.goto('/settings/sessions')
  await expect(page.getByText('Other Device')).toBeVisible()
  await page
    .getByRole('button', { name: /Revoke/ })
    .nth(1)
    .click()
})
