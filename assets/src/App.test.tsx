import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

type FetchStub = Record<string, () => Promise<Response>>

function stubFetch(routes: FetchStub) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const handler = routes[url]
      if (!handler) throw new Error(`unmocked fetch: ${url}`)
      return handler()
    }),
  )
}

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

const profileBody = {
  profile: { id: 'profile-1', name: 'Brave Otter 42', created_at: '2026-01-01T00:00:00Z' },
  secret: 'the-secret',
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('shows the app name and tagline', () => {
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
    })
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Blunderfest' })).toBeInTheDocument()
    expect(screen.getByText('Collaborative chess analysis.')).toBeInTheDocument()
  })

  it('reports the backend as online when healthz succeeds', async () => {
    stubFetch({
      '/api/healthz': () => Promise.resolve(new Response(null, { status: 200 })),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    })
    render(<App />)

    const status = await screen.findByText('Analysis service online')
    expect(status).toHaveAttribute('data-status', 'ok')
  })

  it('reports the backend as unreachable when healthz fails', async () => {
    stubFetch({
      '/api/healthz': () => Promise.resolve(new Response(null, { status: 503 })),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    })
    render(<App />)

    const status = await waitFor(() => screen.getByText('Analysis service unreachable'))
    expect(status).toHaveAttribute('data-status', 'down')
  })

  it('creates an anonymous profile on first visit and shows the generated name', async () => {
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    })
    render(<App />)

    expect(await screen.findByText('You are Brave Otter 42')).toBeInTheDocument()
    expect(localStorage.getItem('blunderfest.device')).toBe(
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    )
  })

  it('reuses a stored device token on later visits', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    )

    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles/profile-1': () => jsonResponse({ profile: profileBody.profile }),
    })
    render(<App />)

    expect(await screen.findByText('You are Brave Otter 42')).toBeInTheDocument()
  })

  it('creates a fresh profile when the stored device is unauthorized', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'stale-profile', secret: 'stale-secret' }),
    )

    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles/stale-profile': () => jsonResponse({ errors: { code: 'unauthorized' } }, 401),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    })
    render(<App />)

    expect(await screen.findByText('You are Brave Otter 42')).toBeInTheDocument()
    expect(localStorage.getItem('blunderfest.device')).toBe(
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    )
  })
})
