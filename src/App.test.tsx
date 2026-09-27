import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PreviewPage } from './pages/PreviewPage'

const configuredEnv = import.meta.env

describe('Sylc app shell', () => {
  it('has a deterministic root element in the document template', () => {
    expect(document.body).toBeInTheDocument()
    expect(configuredEnv).toBeDefined()
  })

  it('renders a clearly labeled preview without backend configuration', () => {
    render(<PreviewPage />)
    expect(screen.getByText('Preview mode')).toBeInTheDocument()
    expect(screen.getByText(/No messages or API keys are accepted/)).toBeInTheDocument()
  })
})
