export type Provider = 'openrouter' | 'mistral'

export interface ProviderConnection {
  provider: Provider
  connected: boolean
  status: 'valid' | 'invalid' | 'unknown'
  updatedAt?: string
  lastValidatedAt?: string
}

export interface ProfilePreferences {
  selectedProvider: Provider
  selectedModelOpenrouter: string | null
  selectedModelMistral: string | null
  theme: 'light' | 'system'
  temperature: number
  maxTokens: number
}

export interface SylcProfile {
  id: string
  displayName: string
  createdAt: string
  providers: ProviderConnection[]
  preferences: ProfilePreferences
}

export interface ProfileSession {
  id: string
  deviceLabel: string
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  current: boolean
}

export interface Conversation {
  id: string
  title: string
  provider: Provider
  modelId: string
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  provider: Provider | null
  modelId: string | null
  createdAt: string
}

export interface ModelPricing {
  prompt?: string | null
  completion?: string | null
  request?: string | null
}

export interface ProviderModel {
  id: string
  name: string
  description?: string | null
  contextLength?: number | null
  pricing?: ModelPricing | null
  capabilities: string[]
  created?: number | null
}

export interface ModelCatalogue {
  provider: Provider
  models: ProviderModel[]
  featured: Record<string, string[]>
}

export interface ApiErrorShape {
  error: {
    code: string
    message: string
    retryAfter?: number
  }
}
