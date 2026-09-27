import { expect, test } from '@playwright/test'

const medalionModel = {
  id: 'test/paid-flagship',
  name: 'Paid Flagship Pro',
  context_length: 128000,
  created: 1780000000,
  pricing: { prompt: '0.00001', completion: '0.00002' },
}
const secondModel = {
  id: 'test/free-second:free',
  name: 'Second Free Model',
  context_length: 32000,
  created: 1770000000,
  pricing: { prompt: '0', completion: '0' },
}
const freeFlagship = {
  id: 'test/free-flagship:free',
  name: 'Free Flagship Pro',
  context_length: 128000,
  created: 1780000000,
  pricing: { prompt: '0', completion: '0' },
}
const yiniModel = {
  id: 'devstral-test',
  name: 'Devstral Coding',
  max_context_length: 128000,
  capabilities: { completion_chat: true },
}
const yiniSecond = {
  id: 'codestral-test',
  name: 'Codestral Coding',
  max_context_length: 32000,
  capabilities: { completion_chat: true },
}

test('keys live in Models, Zen is selected, and direct chat streams', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ json: { data: { label: 'test' } } }),
  )
  await page.route('https://openrouter.ai/api/v1/models', (route) =>
    route.fulfill({ json: { data: [medalionModel, freeFlagship, secondModel] } }),
  )
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON()
    expect(body.model).toBe('test/free-flagship:free')
    expect(body.models).toContain('test/free-second:free')
    expect(body.models).toContain('openrouter/free')
    expect(body.models).not.toContain('test/paid-flagship')
    expect(route.request().headers().authorization).toBe('Bearer test-key')
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\ndata: {"choices":[{"delta":{"content":"Sylc"}}]}\n\ndata: [DONE]\n\n',
    })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Connections' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'Medalion key' }).fill('test-key')
  await page.getByRole('button', { name: 'Connect' }).first().click()
  await expect(page.getByText('Zen', { exact: true })).toBeVisible()
  await expect(page.getByText('Strato', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat' }).click()
  await expect(page.getByLabel('Model')).toHaveValue('Zen')
  await page.getByPlaceholder('Message Sylc…').fill('Hi')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Hello Sylc')).toBeVisible()
})

test('YiNi key selects Kami when entered alone and can be removed', async ({ page }) => {
  await page.route('https://api.mistral.ai/v1/models', (route) =>
    route.fulfill({ json: { data: [yiniModel, yiniSecond] } }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'YiNi key' }).fill('test-key')
  await page.getByRole('button', { name: 'Connect' }).nth(1).click()
  await expect(page.getByText('Kami', { exact: true })).toBeVisible()
  await expect(page.getByText('Zex', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat' }).click()
  await expect(page.getByLabel('Model')).toHaveValue('Kami')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('button', { name: 'Remove key' }).click()
  await expect(page.getByText('Kami', { exact: true })).toHaveCount(0)
})

test('rejects an invalid Medalion key before storing it', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ status: 401, json: { error: 'invalid' } }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'Medalion key' }).fill('bad-key')
  await page.getByRole('button', { name: 'Connect' }).first().click()
  await expect(page.getByRole('alert')).toHaveText('Medalion rejected this key.')
  await expect(page.getByText('Connected')).toHaveCount(0)
})

test('Medalion retries the free router when a chosen free model disappears', async ({ page }) => {
  let attempts = 0
  await page.route('https://openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ json: { data: {} } }),
  )
  await page.route('https://openrouter.ai/api/v1/models', (route) =>
    route.fulfill({ json: { data: [freeFlagship, secondModel] } }),
  )
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    attempts++
    const body = route.request().postDataJSON()
    if (attempts === 1) {
      expect(body.model).toBe('test/free-flagship:free')
      return route.fulfill({ status: 404, json: { error: 'unavailable' } })
    }
    expect(body.model).toBe('openrouter/free')
    return route.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Fallback works"}}]}\n\ndata: [DONE]\n\n',
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'Medalion key' }).fill('test-key')
  await page.getByRole('button', { name: 'Connect' }).first().click()
  await expect(page.getByText('Zen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat' }).click()
  await page.getByPlaceholder('Message Sylc…').fill('Hi')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Fallback works')).toBeVisible()
  expect(attempts).toBe(2)
})

test('a current question searches and keeps the answer in chat', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ json: { data: {} } }),
  )
  await page.route('https://openrouter.ai/api/v1/models', (route) =>
    route.fulfill({ json: { data: [freeFlagship, secondModel] } }),
  )
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON()
    expect(body.tools).toEqual([
      { type: 'openrouter:web_search', parameters: { max_uses: 1, max_results: 3 } },
    ])
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Recent answer with sources."}}]}\n\ndata: [DONE]\n\n',
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'Medalion key' }).fill('test-key')
  await page.getByRole('button', { name: 'Connect' }).first().click()
  await expect(page.getByText('Zen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat' }).click()
  await page.getByPlaceholder('Message Sylc…').fill('What is the latest news today?')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Recent answer with sources.')).toBeVisible()
})

test('search failure falls back to a normal answer with a freshness notice', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ json: { data: {} } }),
  )
  await page.route('https://openrouter.ai/api/v1/models', (route) =>
    route.fulfill({ json: { data: [freeFlagship, secondModel] } }),
  )
  let requests = 0
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    requests++
    const body = route.request().postDataJSON()
    if (requests === 1) {
      expect(body.tools).toBeDefined()
      return route.fulfill({ status: 402, json: { error: 'search needs credits' } })
    }
    expect(body.tools).toBeUndefined()
    return route.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Best known answer."}}]}\n\ndata: [DONE]\n\n',
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'Medalion key' }).fill('test-key')
  await page.getByRole('button', { name: 'Connect' }).first().click()
  await expect(page.getByText('Zen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat' }).click()
  await page.getByPlaceholder('Message Sylc…').fill('What is the current score?')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText(/could not check live sources/)).toBeVisible()
  await expect(page.getByText(/Best known answer/)).toBeVisible()
  expect(requests).toBe(2)
})

test('YiNi searches recent questions through conversations', async ({ page }) => {
  await page.route('https://api.mistral.ai/v1/models', (route) =>
    route.fulfill({ json: { data: [yiniModel] } }),
  )
  await page.route('https://api.mistral.ai/v1/conversations', async (route) => {
    const body = route.request().postDataJSON()
    expect(body.tools).toEqual([{ type: 'web_search' }])
    await route.fulfill({
      json: {
        outputs: [
          {
            type: 'message.output',
            content: [
              { type: 'text', text: 'Fresh answer.' },
              { type: 'tool_reference', title: 'Source', url: 'https://example.com/source' },
            ],
          },
        ],
      },
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'YiNi key' }).fill('test-key')
  await page.getByRole('button', { name: 'Connect' }).nth(1).click()
  await expect(page.getByText('Kami', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat' }).click()
  await page.getByPlaceholder('Message Sylc…').fill('What is the latest release?')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Fresh answer.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Source' })).toHaveAttribute(
    'href',
    'https://example.com/source',
  )
})
