import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

function mockHealthz(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('shows the app name and tagline', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Blunderfest' })).toBeInTheDocument()
    expect(screen.getByText('Collaborative chess analysis.')).toBeInTheDocument()
  })

  it('reports the backend as online when healthz succeeds', async () => {
    mockHealthz(200)
    render(<App />)

    const status = await screen.findByText('Analysis service online')
    expect(status).toHaveAttribute('data-status', 'ok')
  })

  it('reports the backend as unreachable when healthz fails', async () => {
    mockHealthz(503)
    render(<App />)

    const status = await waitFor(() => screen.getByText('Analysis service unreachable'))
    expect(status).toHaveAttribute('data-status', 'down')
  })
})