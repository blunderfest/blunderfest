import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Import from './Import'

type FetchStub = Record<string, (init?: RequestInit) => Promise<Response>>

function stubFetch(routes: FetchStub) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const handler = routes[url]
      if (!handler) throw new Error(`unmocked fetch: ${url}`)
      return handler(init)
    }),
  )
}

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

const tree = {
  headers: { White: 'Alice', Black: 'Bob', Event: 'Test Game' },
  result: '*',
  setup: null,
  mainline_ply_count: 4,
  node_count: 7,
  root: {
    id: 0,
    ply: 0,
    san: null,
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    children: [
      {
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        promotion: null,
        comment: null,
        nags: [],
        status: 'active',
        children: [
          {
            id: 2,
            ply: 2,
            san: 'e5',
            from: 'e7',
            to: 'e5',
            promotion: null,
            comment: null,
            nags: [],
            status: 'active',
            children: [],
          },
        ],
      },
    ],
  },
}

const pgn = '1. e4 e5 *\n'

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Import', () => {
  it('imports pasted PGN and shows the parsed game', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ tree }),
    })
    render(<Import onBack={vi.fn()} onAnalyze={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: pgn } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('1. e4 2. e5')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Test Game')).toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('prefers a Lichess URL over pasted PGN', async () => {
    stubFetch({
      '/api/import/lichess': () => jsonResponse({ tree }),
    })
    render(<Import onBack={vi.fn()} onAnalyze={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: pgn } })
    fireEvent.change(screen.getByLabelText('Lichess URL'), {
      target: { value: 'https://lichess.org/abc123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('1. e4 2. e5')).toBeInTheDocument()
  })

  it('shows the error message when the PGN is invalid', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ errors: { code: 'invalid_pgn' } }, 422),
    })
    render(<Import onBack={vi.fn()} onAnalyze={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: 'not pgn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('This PGN could not be parsed.')).toBeInTheDocument()
  })

  it('keeps the submit disabled while both inputs are empty', () => {
    render(<Import onBack={vi.fn()} onAnalyze={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('navigates back when the back button is clicked', () => {
    const onBack = vi.fn()
    render(<Import onBack={onBack} onAnalyze={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('imports again after a failed attempt', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ errors: { code: 'invalid_pgn' } }, 422),
    })
    render(<Import onBack={vi.fn()} onAnalyze={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() =>
      expect(screen.getByText('This PGN could not be parsed.')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Import' })).not.toBeDisabled()
  })
})
