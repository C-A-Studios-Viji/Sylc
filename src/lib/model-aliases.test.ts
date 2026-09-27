import { describe, expect, it } from 'vitest'
import { aliasesFor } from './model-aliases'
import type { ModelCatalogue } from '../types/api'

describe('model aliases', () => {
  const catalogue: ModelCatalogue = {
    provider: 'openrouter',
    models: ['a', 'b', 'c'].map((id) => ({
      id,
      name: id,
      description: null,
      contextLength: null,
      pricing: null,
      capabilities: [],
      created: null,
    })),
    featured: { best_overall: ['c', 'a', 'c'], best_coding: ['b', 'a'] },
  }

  it('uses distinct available models in ranking order', () => {
    expect(aliasesFor('openrouter', catalogue).map(({ name, modelId }) => [name, modelId])).toEqual(
      [
        ['Zen', 'c'],
        ['Strato', 'a'],
      ],
    )
    expect(aliasesFor('mistral', catalogue).map(({ name, modelId }) => [name, modelId])).toEqual([
      ['Kami', 'b'],
      ['Zex', 'a'],
    ])
  })
})
