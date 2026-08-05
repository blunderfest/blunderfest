import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Analysis from './Analysis'
import type { GameTree, GameNode } from './api'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function node(partial: Partial<GameNode>): GameNode {
  return {
    id: 0,
    ply: 1,
    san: '',
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: START_FEN,
    children: [],
    ...partial,
  }
}

const tree: GameTree = {
  headers: { White: 'Alice', Black: 'Bob', Event: 'Test Game' },
  result: '*',
  setup: null,
  mainline_ply_count: 4,
  node_count: 6,
  root: node({
    id: 0,
    ply: 0,
    san: null,
    children: [
      node({
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        children: [
          node({
            id: 2,
            ply: 2,
            san: 'e5',
            from: 'e7',
            to: 'e5',
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
            children: [
              node({
                id: 4,
                ply: 3,
                san: 'Nf3',
                from: 'g1',
                to: 'f3',
                fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
              }),
            ],
          }),
          node({
            id: 3,
            ply: 2,
            san: 'c5',
            from: 'c7',
            to: 'c5',
            fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
            comment: 'Sicilian',
          }),
        ],
      }),
    ],
  }),
}

function renderAnalysis() {
  return render(<Analysis tree={tree} onBack={vi.fn()} />)
}

describe('Analysis', () => {
  it('renders the start position on the board', () => {
    renderAnalysis()

    expect(screen.getByTestId('square-e1')).toHaveTextContent('♔')
    expect(screen.getByTestId('square-e8')).toHaveTextContent('♚')
    expect(screen.getByTestId('square-d2')).toHaveTextContent('♙')
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♙')
  })

  it('navigates forward and backward with the buttons', () => {
    renderAnalysis()

    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }))
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♙')
    expect(screen.getByTestId('square-e2')).not.toHaveTextContent('♙')

    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }))
    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟')

    fireEvent.click(screen.getByRole('button', { name: '◀ Previous' }))
    expect(screen.getByTestId('square-e5')).not.toHaveTextContent('♟')
  })

  it('jumps to first and last moves', () => {
    renderAnalysis()

    fireEvent.click(screen.getByRole('button', { name: 'Last ⏭' }))
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♘')
    expect(screen.getByTestId('analysis-move-4')).toHaveClass('bg-ink/20')

    fireEvent.click(screen.getByRole('button', { name: '⏮ First' }))
    expect(screen.getByTestId('square-g1')).toHaveTextContent('♘')
  })

  it('clicks a variation in the move list', () => {
    renderAnalysis()

    fireEvent.click(
      screen.getByTestId('analysis-move-3').querySelector('button') as HTMLButtonElement,
    )
    expect(screen.getByTestId('square-c5')).toHaveTextContent('♟')
    expect(screen.getByText('Sicilian')).toBeInTheDocument()
  })

  it('shows the checkmate status badge', () => {
    const mateTree: GameTree = {
      ...tree,
      root: node({
        id: 0,
        ply: 0,
        san: null,
        children: [
          node({
            id: 1,
            ply: 1,
            san: 'Ra8#',
            from: 'a1',
            to: 'a8',
            status: 'checkmate',
            fen: 'R6k/5ppp/8/8/8/8/8/R6K b - - 1 1',
          }),
        ],
      }),
    }
    render(<Analysis tree={mateTree} onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }))
    expect(screen.getByText('Checkmate')).toBeInTheDocument()
  })

  it('navigates with the arrow keys', () => {
    renderAnalysis()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♙')

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♙')
  })

  it('shows the fallback screen when no game is loaded', () => {
    render(<Analysis tree={null} onBack={vi.fn()} />)

    expect(screen.getByText('Import a game to start analyzing.')).toBeInTheDocument()
  })

  it('navigates back when the back button is clicked', () => {
    const onBack = vi.fn()
    render(<Analysis tree={tree} onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
