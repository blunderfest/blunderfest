import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MoveList from '@/features/analysis/MoveList';
import { buildRows } from '@/features/analysis/moveList';
import type { GameNode, GameTree } from '@/lib/api';

function node(id: number, ply: number, san: string | null, children: GameNode[] = []): GameNode {
  return {
    id,
    ply,
    san,
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: null,
    children,
  };
}

function makeTree(withNested: boolean): GameTree {
  return {
    headers: {},
    result: '*',
    setup: null,
    mainline_ply_count: 2,
    node_count: withNested ? 7 : 6,
    root: node(0, 0, '', [
      node(1, 1, 'e4', [
        node(2, 2, 'e5'),
        node(3, 2, 'c5', [
          node(
            4,
            3,
            'd4',
            withNested ? [node(5, 4, 'cxd4'), node(6, 4, 'dxe5')] : [node(5, 4, 'cxd4')],
          ),
        ]),
      ]),
      node(7, 1, 'd4'),
    ]),
  };
}

function renderList(t: GameTree = makeTree(false), currentId: number | null = null) {
  return render(
    <MoveList
      rows={buildRows(t)}
      currentId={currentId}
      onSelect={vi.fn()}
      navTargets={{ first: 0, prev: null, next: null, last: null }}
      currentPly={0}
      totalPly={t.mainline_ply_count}
    />,
  );
}

function moveText(id: number): string {
  return screen.getByTestId(`analysis-move-${id}`).textContent?.trim() ?? '';
}

describe('MoveList move numbers', () => {
  it('numbers white mainline moves but not the black move paired with them', () => {
    renderList();
    expect(moveText(1)).toBe('1. e4');
    expect(moveText(2)).toBe('e5');
  });

  it('numbers a root variation like any white move', () => {
    renderList();
    expect(moveText(7)).toBe('1. d4');
  });

  it('marks the first move of a black-to-move variation with ...', () => {
    renderList();
    expect(moveText(3)).toBe('1... c5');
  });

  it('does not repeat the number for black moves flowing inside a variation', () => {
    renderList();
    expect(moveText(4)).toBe('2. d4');
    expect(moveText(5)).toBe('cxd4');
  });

  it('renders a setup node as a Setup token without a move number', () => {
    const withSetup = makeTree(false);
    withSetup.root.children[0].children.push(node(8, 2, null));
    renderList(withSetup);
    expect(moveText(8)).toBe('⚙ Setup');
  });

  it('re-marks a black move after a nested variation interrupts the line', () => {
    renderList(makeTree(true));
    // The line reads: ( 1... c5 2. d4 ( 2... dxe5 ) 2... cxd4 )
    expect(moveText(6)).toBe('2... dxe5');
    expect(moveText(5)).toBe('2... cxd4');
  });
});

describe('MoveList keyboard navigation (listbox pattern)', () => {
  it('keeps a single move in the tab order and roves with the arrow keys', () => {
    renderList(makeTree(false), 1);
    const buttons = screen
      .getAllByRole('option')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('analysis-move-'));
    const tabStops = buttons.filter((el) => el.tabIndex === 0);
    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]).toBe(screen.getByTestId('analysis-move-1'));

    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByTestId('analysis-move-2')).toHaveFocus();
    expect(screen.getByTestId('analysis-move-2').tabIndex).toBe(0);
    expect(screen.getByTestId('analysis-move-1').tabIndex).toBe(-1);
  });

  it('selects the focused move with Enter', () => {
    const onSelect = vi.fn();
    render(
      <MoveList
        rows={buildRows(makeTree(false))}
        currentId={1}
        onSelect={onSelect}
        navTargets={{ first: 0, prev: null, next: null, last: null }}
        currentPly={1}
        totalPly={2}
      />,
    );
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});

describe('MoveList scrolling', () => {
  it('scrolls the current move into view', () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    try {
      renderList(makeTree(false), 3);
      expect(scrollSpy).toHaveBeenCalled();
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

it('scrolls back to the top when the root position is current', () => {
  const scrollSpy = vi.fn();
  Element.prototype.scrollTo = scrollSpy;
  try {
    renderList(makeTree(false), 0);
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0 });
  } finally {
    delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
  }
});

describe('MoveList comment placement', () => {
  it('renders a mainline comment directly under its own move', () => {
    const t = makeTree(false);
    t.root.children[0].comment = 'White note';
    t.root.children[0].children[0].comment = 'Black note';
    renderList(t);

    const white = screen.getByTestId('analysis-move-1');
    const black = screen.getByTestId('analysis-move-2');
    const whiteComment = screen.getByText('White note');
    const blackComment = screen.getByText('Black note');

    // 1. e4 [White note] e5 [Black note] — each block right after its move.
    expect(
      white.compareDocumentPosition(whiteComment) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      whiteComment.compareDocumentPosition(black) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      black.compareDocumentPosition(blackComment) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows variation comments inline after the move', () => {
    const t = makeTree(false);
    t.root.children[0].children[1].comment = 'The Sicilian';
    renderList(t);

    expect(document.getElementById('analysis-move-list')).toHaveTextContent('The Sicilian');
    const c5 = screen.getByTestId('analysis-move-3');
    expect(
      c5.compareDocumentPosition(screen.getByText('The Sicilian')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
