import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Home from './Home'

function renderHome(onJoin = vi.fn()) {
  const utils = render(<Home backend="ok" onJoin={onJoin} onImport={vi.fn()} />)
  return { onJoin, ...utils }
}

describe('Home', () => {
  it('creates a room with a generated 5-character code', () => {
    const { onJoin } = renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }))
    expect(onJoin).toHaveBeenCalledTimes(1)
    expect(onJoin.mock.calls[0][0]).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/)
  })

  it('joins a room with a normalized code', () => {
    const { onJoin } = renderHome()
    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: ' AbC-1_2 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(onJoin).toHaveBeenCalledWith('abc12')
  })

  it('joins a room when pressing Enter in the input', () => {
    const { onJoin } = renderHome()
    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: 'xyz99' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Room code'), { key: 'Enter' })
    expect(onJoin).toHaveBeenCalledWith('xyz99')
  })

  it('shows an error when joining with an empty code', () => {
    const { onJoin } = renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(screen.getByText('Enter a room code')).toBeInTheDocument()
    expect(onJoin).not.toHaveBeenCalled()
  })
})
