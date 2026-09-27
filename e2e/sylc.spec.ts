import { expect, test } from '@playwright/test'

const medalionModel = {
  id: 'test/flagship',
  name: 'Flagship Pro',
  context_length: 128000,
  created: 1780000000,
}
const secondModel = {
  id: 'test/second',
  name: 'Second Model',
  context_length: 32000,
  created: 1770000000,
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
  await page.route('https://openrouter.ai/api/v1/models', (route) =>
    route.fulfill({ json: { data: [medalionModel, secondModel] } }),
  )
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON()
    expect(body.model).toBe('test/flagship')
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
