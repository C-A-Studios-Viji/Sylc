import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Sylc app', () => {
  it('renders chat and model key entry without a backend', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Models' })[0]).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connections' })).not.toBeInTheDocument()
  })
})
