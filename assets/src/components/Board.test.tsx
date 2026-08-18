import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Board from '@/components/Board';
import { parseFen } from '@/components/board';

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

  it('never takes keyboard focus on a mouse click, keeping arrows free for game navigation', () => {
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
    expect(screen.getByTestId('square-g5')).not.toHaveFocus();
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

  it('renders hint arrows as ghosts — translucent and thinner than solid annotations', () => {
    render(
      <Board
        position={emptyPosition()}
        arrows={[
          { from: 'e2', to: 'e4', hint: true },
          { from: 'd2', to: 'd4' },
        ]}
      />,
    );
    const svg = screen.getByTestId('board-arrows');
    const groups = svg.querySelectorAll('g');
    expect(groups).toHaveLength(2);

    // The hint arrow: ghost group with a thin line.
    const hint = groups[0];
    expect(hint.getAttribute('opacity')).toBe('0.55');
    expect(hint.querySelector('line')?.getAttribute('stroke-width')).toBe('0.14');

    // The user arrow: flat and solid — same family, no outline, full weight.
    const solid = groups[1];
    expect(solid.getAttribute('opacity')).toBeNull();
    expect(solid.querySelector('line')?.getAttribute('stroke-width')).toBe('0.28');
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

describe('Board pointer interactions', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  function pointer(
    grid: HTMLElement,
    type: string,
    init: MouseEventInit & { pointerType?: string; pointerId?: number } = {},
  ) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
    // jsdom has no PointerEvent: React reads these through from the native
    // event, and the window draw listeners see the native event directly.
    if (init.pointerType !== undefined) {
      Object.defineProperty(event, 'pointerType', { value: init.pointerType });
    }
    if (init.pointerId !== undefined) {
      Object.defineProperty(event, 'pointerId', { value: init.pointerId });
    }
    fireEvent(grid, event);
  }

  function renderInteractive(props: Partial<Parameters<typeof Board>[0]> = {}) {
    const utils = render(
      <Board position={parseFen(START)} interactive onSquareClick={vi.fn()} {...props} />,
    );
    const grid = utils.container.querySelector('[data-board-grid]') as HTMLElement;
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 800,
        right: 800,
        bottom: 800,
        x: 0,
        y: 0,
      }) as DOMRect;
    return { grid, ...utils };
  }

  it('drags a piece to a target square', () => {
    const onDragMove = vi.fn();
    const { grid } = renderInteractive({ onDragMove });

    pointer(grid, 'pointerdown', { button: 0, clientX: 450, clientY: 650 });
    pointer(grid, 'pointermove', { clientX: 455, clientY: 560 });
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();
    pointer(grid, 'pointerup', { button: 0, clientX: 450, clientY: 450 });

    expect(onDragMove).toHaveBeenCalledWith('e2', 'e4');
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
  });

  it('hides the piece on its source square while dragging', () => {
    const onDragMove = vi.fn();
    const { grid } = renderInteractive({ onDragMove });

    expect(screen.getByTestId('square-e2').querySelector('[data-piece]')).not.toBeNull();

    pointer(grid, 'pointerdown', { button: 0, clientX: 450, clientY: 650 });
    pointer(grid, 'pointermove', { clientX: 455, clientY: 560 });
    // The piece is being carried: its square shows nothing mid-drag.
    expect(screen.getByTestId('square-e2').querySelector('[data-piece]')).toBeNull();

    pointer(grid, 'pointerup', { button: 0, clientX: 450, clientY: 450 });
    // The position prop didn't change (no echo here), so it returns.
    expect(screen.getByTestId('square-e2').querySelector('[data-piece]')).not.toBeNull();
  });

  it('reports null when a piece is dropped off the board', () => {
    const onDragMove = vi.fn();
    const { grid } = renderInteractive({ onDragMove });

    pointer(grid, 'pointerdown', { button: 0, clientX: 450, clientY: 650 });
    pointer(grid, 'pointermove', { clientX: 460, clientY: 200 });
    pointer(grid, 'pointerup', { button: 0, clientX: 460, clientY: -50 });

    expect(onDragMove).toHaveBeenCalledWith('e2', null);
  });

  it('reports the hovered square while dragging, and null when the drag ends', () => {
    const onDragHover = vi.fn();
    const { grid } = renderInteractive({ onDragHover });

    pointer(grid, 'pointerdown', { button: 0, clientX: 450, clientY: 650 });
    pointer(grid, 'pointermove', { clientX: 455, clientY: 560 });
    expect(onDragHover).toHaveBeenLastCalledWith('e2', 'e3');
    pointer(grid, 'pointermove', { clientX: 455, clientY: 460 });
    expect(onDragHover).toHaveBeenLastCalledWith('e2', 'e4');
    // The same square doesn't fire twice.
    const calls = onDragHover.mock.calls.length;
    pointer(grid, 'pointermove', { clientX: 456, clientY: 462 });
    expect(onDragHover.mock.calls.length).toBe(calls);

    pointer(grid, 'pointerup', { button: 0, clientX: 450, clientY: 450 });
    expect(onDragHover).toHaveBeenLastCalledWith('e2', null);
  });

  it('renders the drag flag on the target square', () => {
    render(<Board position={parseFen(START)} dragMark={{ square: 'e4', mark: '??' }} />);

    expect(screen.getByTestId('drag-mark-e4')).toHaveTextContent('??');
    expect(screen.queryByTestId('drag-mark-e3')).not.toBeInTheDocument();
  });

  it('does not start a drag without a piece move threshold', () => {
    const onDragMove = vi.fn();
    const onSquareClick = vi.fn();
    const { grid } = renderInteractive({ onDragMove, onSquareClick });

    pointer(grid, 'pointerdown', { button: 0, clientX: 450, clientY: 650 });
    pointer(grid, 'pointerup', { button: 0, clientX: 451, clientY: 649 });

    expect(onDragMove).not.toHaveBeenCalled();
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
  });

  it('toggles a highlight on right-click in the current drawing color', () => {
    const onToggleHighlight = vi.fn();
    const { grid } = renderInteractive({ onToggleHighlight, drawColor: '#e05a4e' });

    pointer(grid, 'pointerdown', { button: 2, clientX: 450, clientY: 650 });
    pointer(grid, 'pointerup', { button: 2, clientX: 450, clientY: 650 });
    expect(onToggleHighlight).toHaveBeenCalledWith('e2', '#e05a4e');
  });

  it('draws an arrow on right-drag', () => {
    const onDrawArrow = vi.fn();
    const { grid } = renderInteractive({ onDrawArrow });

    pointer(grid, 'pointerdown', { button: 2, clientX: 450, clientY: 650 });
    pointer(grid, 'pointermove', { buttons: 2, clientX: 450, clientY: 450 });
    pointer(grid, 'pointerup', { button: 2, clientX: 450, clientY: 450 });

    expect(onDrawArrow).toHaveBeenCalledWith('e2', 'e4', '#3b82f6');
  });

  it('commits the arrow when a released-button move arrives without pointerup (Vivaldi gestures)', () => {
    const onDrawArrow = vi.fn();
    const { grid } = renderInteractive({ onDrawArrow });

    // Vivaldi's gesture layer swallows the whole right-drag, pointerup
    // included; the first event after the release is a plain move (buttons=0).
    pointer(grid, 'pointerdown', { button: 2, clientX: 450, clientY: 650 });
    pointer(grid, 'pointermove', { buttons: 0, clientX: 450, clientY: 450 });

    expect(onDrawArrow).toHaveBeenCalledTimes(1);
    expect(onDrawArrow).toHaveBeenCalledWith('e2', 'e4', '#3b82f6');

    // The draw is over: further moves do not commit again.
    pointer(grid, 'pointermove', { buttons: 0, clientX: 250, clientY: 250 });
    expect(onDrawArrow).toHaveBeenCalledTimes(1);
  });

  it('toggles a highlight when the released-button move lands on the start square (Vivaldi right-click)', () => {
    const onToggleHighlight = vi.fn();
    const { grid } = renderInteractive({ onToggleHighlight });

    pointer(grid, 'pointerdown', { button: 2, clientX: 450, clientY: 650 });
    pointer(grid, 'pointermove', { buttons: 0, clientX: 451, clientY: 649 });

    expect(onToggleHighlight).toHaveBeenCalledWith('e2', '#3b82f6');
    expect(onToggleHighlight).toHaveBeenCalledTimes(1);
  });

  describe('long-press drawing (touch/pen)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('toggles a highlight on a touch long-press, suppressing the release click', () => {
      const onToggleHighlight = vi.fn();
      const onSquareClick = vi.fn();
      const { grid } = renderInteractive({ onToggleHighlight, onSquareClick });

      pointer(grid, 'pointerdown', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 650,
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      pointer(grid, 'pointerup', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 650,
      });

      expect(onToggleHighlight).toHaveBeenCalledWith('e2', '#3b82f6');

      // The browser still fires a click after the release; it must not act.
      fireEvent.click(screen.getByTestId('square-e2'));
      expect(onSquareClick).not.toHaveBeenCalled();
    });

    it('draws an arrow on long-press + drag, with a live preview and no piece ghost', () => {
      const onDrawArrow = vi.fn();
      const onToggleHighlight = vi.fn();
      const { grid } = renderInteractive({ onDrawArrow, onToggleHighlight });

      pointer(grid, 'pointerdown', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 650,
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      // Finger travels with the contact still down (touch moves report buttons=1).
      pointer(grid, 'pointermove', {
        buttons: 1,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 450,
      });
      expect(screen.getByTestId('board-arrows')).toBeInTheDocument();
      expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();

      pointer(grid, 'pointerup', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 450,
      });

      expect(onDrawArrow).toHaveBeenCalledWith('e2', 'e4', '#3b82f6');
      expect(onToggleHighlight).not.toHaveBeenCalled();
    });

    it('starts a piece drag when the finger moves before the long-press fires', () => {
      const onDrawArrow = vi.fn();
      const onToggleHighlight = vi.fn();
      const onDragMove = vi.fn();
      const { grid } = renderInteractive({ onDrawArrow, onToggleHighlight, onDragMove });

      pointer(grid, 'pointerdown', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 650,
      });
      pointer(grid, 'pointermove', {
        buttons: 1,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 470,
        clientY: 630,
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();

      pointer(grid, 'pointerup', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 450,
      });

      expect(onDrawArrow).not.toHaveBeenCalled();
      expect(onToggleHighlight).not.toHaveBeenCalled();
      expect(onDragMove).toHaveBeenCalledWith('e2', 'e4');
    });

    it('keeps quick taps as plain clicks', () => {
      const onSquareClick = vi.fn();
      const onToggleHighlight = vi.fn();
      const { grid } = renderInteractive({ onSquareClick, onToggleHighlight });

      pointer(grid, 'pointerdown', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 650,
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      pointer(grid, 'pointerup', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientX: 450,
        clientY: 650,
      });
      fireEvent.click(screen.getByTestId('square-e2'));

      expect(onSquareClick).toHaveBeenCalledWith('e2');
      expect(onToggleHighlight).not.toHaveBeenCalled();
    });

    it('arms the long-press for pen input too', () => {
      const onToggleHighlight = vi.fn();
      const { grid } = renderInteractive({ onToggleHighlight });

      pointer(grid, 'pointerdown', {
        button: 0,
        pointerType: 'pen',
        pointerId: 3,
        clientX: 450,
        clientY: 650,
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      pointer(grid, 'pointerup', {
        button: 0,
        pointerType: 'pen',
        pointerId: 3,
        clientX: 450,
        clientY: 650,
      });

      expect(onToggleHighlight).toHaveBeenCalledWith('e2', '#3b82f6');
    });

    it('does not arm the long-press for the mouse', () => {
      const onSquareClick = vi.fn();
      const onToggleHighlight = vi.fn();
      const { grid } = renderInteractive({ onSquareClick, onToggleHighlight });

      pointer(grid, 'pointerdown', {
        button: 0,
        pointerType: 'mouse',
        pointerId: 1,
        clientX: 450,
        clientY: 650,
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      pointer(grid, 'pointerup', {
        button: 0,
        pointerType: 'mouse',
        pointerId: 1,
        clientX: 450,
        clientY: 650,
      });
      fireEvent.click(screen.getByTestId('square-e2'));

      expect(onSquareClick).toHaveBeenCalledWith('e2');
      expect(onToggleHighlight).not.toHaveBeenCalled();
    });
  });

  it('toggles highlights with h and draws arrows with a', () => {
    const onToggleHighlight = vi.fn();
    const onDrawArrow = vi.fn();
    renderInteractive({ onToggleHighlight, onDrawArrow });

    const e4 = screen.getByTestId('square-e4');
    e4.focus();
    fireEvent.keyDown(e4, { key: 'h' });
    expect(onToggleHighlight).toHaveBeenCalledWith('e4', '#3b82f6');

    fireEvent.keyDown(e4, { key: 'a' });
    fireEvent.keyDown(e4, { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByTestId('square-e5'), { key: 'a' });
    expect(onDrawArrow).toHaveBeenCalledWith('e4', 'e5', '#3b82f6');
  });

  it('picks the drawing color with the 1-4 keys', () => {
    const onDrawColorChange = vi.fn();
    renderInteractive({ onDrawColorChange });

    const e4 = screen.getByTestId('square-e4');
    e4.focus();
    fireEvent.keyDown(e4, { key: '3' });
    expect(onDrawColorChange).toHaveBeenCalledWith('#a855f7');
  });

  it('cancels a keyboard arrow draft with Escape', () => {
    const onDrawArrow = vi.fn();
    renderInteractive({ onDrawArrow });

    const e4 = screen.getByTestId('square-e4');
    e4.focus();
    fireEvent.keyDown(e4, { key: 'a' });
    fireEvent.keyDown(e4, { key: 'Escape' });
    fireEvent.keyDown(e4, { key: 'a' });
    fireEvent.keyDown(e4, { key: 'a' });
    expect(onDrawArrow).not.toHaveBeenCalled();
  });

  it('renders highlights and colored arrows', () => {
    render(
      <Board
        position={parseFen(START)}
        highlights={[{ square: 'e4', color: '#4caf50' }]}
        arrows={[{ from: 'e2', to: 'e4', color: '#e05a4e' }]}
      />,
    );
    expect(screen.getByTestId('highlight-e4')).toBeInTheDocument();
    const heads = screen.getAllByTestId('arrow-head');
    expect(heads[heads.length - 1].getAttribute('fill')).toBe('#e05a4e');
  });
});
