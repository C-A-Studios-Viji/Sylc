import { expect, test } from '@playwright/test'

const freeFlagship = {
  id: 'test/free-flagship:free',
  name: 'Free Flagship Pro',
  context_length: 128000,
  created: 1780000000,
  pricing: { prompt: '0', completion: '0' },
}

async function connectMedalion(page: import('@playwright/test').Page) {
  await page.route('https://openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ json: { data: {} } }),
  )
  await page.route('https://openrouter.ai/api/v1/models', (route) =>
    route.fulfill({ json: { data: [freeFlagship] } }),
  )
  await page.getByRole('textbox', { name: 'Medalion key' }).fill('model-key')
  await page.getByRole('button', { name: 'Connect' }).nth(1).click()
  await expect(page.getByText('Zen', { exact: true })).toBeVisible()
}

test('Live info is required before a selected model can chat', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await connectMedalion(page)
  await page.getByRole('button', { name: 'Chat' }).click()
  await page.getByPlaceholder('Message Sylc…').fill('Hello')
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await expect(page.getByText('Open Models to add the required Live info key.')).toBeVisible()
})

test('every reply uses forced browser search and a current India date', async ({ page }) => {
  await page.route('https://api.groq.com/openai/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'openai/gpt-oss-20b' }] } }),
  )
  await page.route('https://api.groq.com/openai/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON()
    expect(route.request().headers().authorization).toBe('Bearer live-key')
    expect(body.model).toBe('openai/gpt-oss-20b')
    expect(body.tools).toEqual([{ type: 'browser_search' }])
    expect(body.tool_choice).toBe('required')
    expect(body.messages[0].content).toContain('current time in India')
    expect(body.messages[0].content).toContain('Only mention a date, day, or time when it is necessary')
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'What day is it?' })
    await route.fulfill({
      json: { choices: [{ message: { content: 'Sunday, September 27, 2026.' } }] },
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'Live info key' }).fill('live-key')
  await page.getByRole('button', { name: 'Connect' }).first().click()
  await expect(page.getByText('Required for every reply.')).toBeVisible()
  await connectMedalion(page)
  await page.getByRole('button', { name: 'Chat' }).click()
  await page.getByPlaceholder('Message Sylc…').fill('What day is it?')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Sunday, September 27, 2026.')).toBeVisible()
})

test('an invalid Live info key is not connected', async ({ page }) => {
  await page.route('https://api.groq.com/openai/v1/models', (route) =>
    route.fulfill({ status: 401, json: { error: 'invalid' } }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).first().click()
  await page.getByRole('textbox', { name: 'Live info key' }).fill('bad-key')
  await page.getByRole('button', { name: 'Connect' }).first().click()
  await expect(page.getByRole('alert')).toHaveText('Live info rejected this key.')
  await expect(page.getByText('Required', { exact: true })).toBeVisible()
})
