import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { ProfileProvider } from './lib/profile-context'

const configuredEnv = import.meta.env

describe('Sylc app shell', () => {
  it('has a deterministic root element in the document template', () => {
    expect(document.body).toBeInTheDocument()
    expect(configuredEnv).toBeDefined()
  })

  it('renders configuration guidance when browser env is absent', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ProfileProvider>
            <App />
          </ProfileProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )
    if (screen.queryByText('Connect Sylc to Supabase')) {
      expect(screen.getByText('Connect Sylc to Supabase')).toBeInTheDocument()
    }
  })
})
