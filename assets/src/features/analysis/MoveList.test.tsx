import { render, screen } from '@testing-library/react';
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
      nodeCount={t.node_count}
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
