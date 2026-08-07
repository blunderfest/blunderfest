import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Board from '@/components/Board';

function emptyPosition() {
  return new Array(64).fill(null);
}

/**
 * The square currently in the tab order, focused as if reached via Tab, so it
 * matches :focus-visible the way a keyboard user's focus does.
 */
function focusedSquareButton() {
  return screen.getAllByRole('button').find((button) => button.tabIndex === 0) as HTMLElement;
}

function pressKey(key: string) {
  const square = focusedSquareButton();
  square.focus();
  fireEvent.keyDown(square, { key });
}

describe('Board', () => {
  it('renders 64 labeled squares as buttons when interactive', () => {
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(64);
    expect(screen.getByRole('button', { name: 'a8' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'h1' })).toBeInTheDocument();
  });

  it('keeps a single square in the tab order, starting on e4 without a last move', () => {
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('square-e4')).toHaveAttribute('tabindex', '0');
    for (const button of screen.getAllByRole('button')) {
      if (button.dataset.testid !== 'square-e4') {
        expect(button).toHaveAttribute('tabindex', '-1');
      }
    }
  });

  it('starts on the destination square of the last move', () => {
    render(
      <Board
        position={emptyPosition()}
        lastMove={{ from: 'e2', to: 'e4' }}
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('square-e4')).toHaveAttribute('tabindex', '0');
  });

  it('moves focus with the arrow keys and stops at the board edges', () => {
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={vi.fn()}
      />,
    );
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e5')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e6')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e7')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e8')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e8')).toHaveAttribute('tabindex', '0');

    pressKey('ArrowDown');
    expect(screen.getByTestId('square-e7')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-d7')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-c7')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-b7')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-a7')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-a7')).toHaveAttribute('tabindex', '0');

    pressKey('ArrowRight');
    expect(screen.getByTestId('square-b7')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    expect(screen.getByTestId('square-b1')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowRight');
    pressKey('ArrowRight');
    pressKey('ArrowRight');
    pressKey('ArrowRight');
    pressKey('ArrowRight');
    pressKey('ArrowRight');
    expect(screen.getByTestId('square-h1')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowRight');
    expect(screen.getByTestId('square-h1')).toHaveAttribute('tabindex', '0');
  });

  it('moves focus consistently when the board is flipped', () => {
    render(
      <Board
        position={emptyPosition()}
        flipped
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={vi.fn()}
      />,
    );
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e3')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e2')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e1')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowUp');
    expect(screen.getByTestId('square-e1')).toHaveAttribute('tabindex', '0');

    pressKey('ArrowDown');
    expect(screen.getByTestId('square-e2')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowRight');
    expect(screen.getByTestId('square-d2')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowRight');
    expect(screen.getByTestId('square-c2')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowRight');
    expect(screen.getByTestId('square-b2')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowRight');
    expect(screen.getByTestId('square-a2')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowRight');
    expect(screen.getByTestId('square-a2')).toHaveAttribute('tabindex', '0');

    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-b2')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    expect(screen.getByTestId('square-b8')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowLeft');
    pressKey('ArrowLeft');
    pressKey('ArrowLeft');
    pressKey('ArrowLeft');
    pressKey('ArrowLeft');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-h8')).toHaveAttribute('tabindex', '0');
    pressKey('ArrowLeft');
    expect(screen.getByTestId('square-h8')).toHaveAttribute('tabindex', '0');
  });

  it('marks the selected square with aria-pressed', () => {
    const onSquareClick = vi.fn();
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected="e4"
        legalTargets={['e5']}
        onSquareClick={onSquareClick}
      />,
    );

    expect(screen.getByTestId('square-e4')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('square-e5')).toHaveAttribute('aria-pressed', 'false');
  });

  it('plays a move with the keyboard: select, then Enter', async () => {
    const onSquareClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={onSquareClick}
      />,
    );
    pressKey('ArrowRight');
    const fromSquare = screen.getByTestId('square-f4');
    expect(fromSquare).toHaveFocus();

    fireEvent.click(fromSquare);
    expect(onSquareClick).toHaveBeenCalledWith('f4');

    await user.keyboard('{Enter}');
    expect(onSquareClick).toHaveBeenCalledTimes(2);
  });

  it('skips square navigation when the square was focused by mouse, keeping arrows free for game navigation', () => {
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('square-g5'));
    expect(screen.getByTestId('square-g5')).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(screen.getByTestId('square-g5'), { key: 'ArrowRight' });
    expect(screen.getByTestId('square-g5')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('square-h5')).toHaveAttribute('tabindex', '-1');
  });

  it('renders plain squares when not interactive', () => {
    render(<Board position={emptyPosition()} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('square-e4')).toBeInTheDocument();
    expect(screen.getByTestId('square-e4')).not.toHaveAttribute('tabindex');
  });

  it('annotates the selected and target squares visually', () => {
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected="e4"
        legalTargets={['e5', 'd5']}
        onSquareClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('selected-e4')).toBeInTheDocument();
    expect(screen.getByTestId('target-e5')).toBeInTheDocument();
    expect(screen.getByTestId('target-d5')).toBeInTheDocument();
  });

  it('exposes a single tab stop inside the grid', () => {
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected={null}
        legalTargets={[]}
        onSquareClick={vi.fn()}
      />,
    );

    const tabStops = screen.getAllByRole('button').filter((button) => button.tabIndex === 0);
    expect(tabStops).toHaveLength(1);
  });
});

describe('Board arrows', () => {
  it('renders hint arrows over the board', () => {
    render(<Board position={emptyPosition()} arrows={[{ from: 'e2', to: 'e4' }]} />);
    const svg = screen.getByTestId('board-arrows');
    const line = svg.querySelector('line');
    expect(line).not.toBeNull();
    expect(Number(line?.getAttribute('x1'))).toBeCloseTo(4.5);
    expect(Number(line?.getAttribute('y1'))).toBeCloseTo(6.2);
    expect(Number(line?.getAttribute('y2'))).toBeCloseTo(5.2);
  });

  it('mirrors arrows when flipped', () => {
    render(<Board position={emptyPosition()} flipped arrows={[{ from: 'e2', to: 'e4' }]} />);
    const line = screen.getByTestId('board-arrows').querySelector('line');
    expect(Number(line?.getAttribute('x1'))).toBeCloseTo(3.5);
    expect(Number(line?.getAttribute('y1'))).toBeCloseTo(1.8);
  });

  it('renders no arrows by default', () => {
    render(<Board position={emptyPosition()} />);
    expect(screen.queryByTestId('board-arrows')).not.toBeInTheDocument();
  });
});

describe('square positioning', () => {
  it('keeps selected and last-move squares positioned so overlays stay inside them', () => {
    render(
      <Board
        position={emptyPosition()}
        interactive
        selected="e2"
        lastMove={{ from: 'e7', to: 'e5' }}
        legalTargets={['e4']}
        onSquareClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('square-e2')).toHaveClass('relative');
    expect(screen.getByTestId('square-e5')).toHaveClass('relative');
    expect(screen.getByTestId('selected-e2')).toHaveClass('pointer-events-none');
  });
});

describe('check highlight', () => {
  it('glows on the checked king square', () => {
    render(<Board position={emptyPosition()} checkSquare="e8" />);
    expect(screen.getByTestId('check-e8')).toBeInTheDocument();
  });

  it('renders no glow without a check', () => {
    render(<Board position={emptyPosition()} />);
    expect(screen.queryByTestId('check-e8')).not.toBeInTheDocument();
  });
});
