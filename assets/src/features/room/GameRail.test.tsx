import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameRail from '@/features/room/GameRail';
import { emptyGameTree } from '@/lib/api';

function treeWithHeaders(white: string, black: string, setup = false) {
  const tree = emptyGameTree();
  tree.headers.White = white;
  tree.headers.Black = black;
  if (setup) {
    tree.setup = { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq -' };
  }
  return tree;
}

function renderRail(games: Record<string, ReturnType<typeof treeWithHeaders>>, over = {}) {
  const props = {
    games,
    activeGameId: 'g1',
    presenterGameId: null as string | null,
    canEdit: true,
    onSelectGame: vi.fn(),
    onAddGame: vi.fn(),
    onNewGame: vi.fn(),
    onRemoveGame: vi.fn(),
    ...over,
  };
  return { ...render(<GameRail {...props} />), props };
}

describe('GameRail', () => {
  it('lists games with the import and new-game actions', () => {
    renderRail({ g1: treeWithHeaders('Alice', 'Bob') });
    expect(screen.getByText('Alice – Bob')).toBeInTheDocument();
    // The desktop header and the mobile end-tiles both render (viewport
    // classes hide one or the other in a real browser; jsdom has no layout).
    expect(screen.getAllByRole('button', { name: 'Import games' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'New game' }).length).toBeGreaterThan(0);
  });

  it('selects a game on click', () => {
    const { props } = renderRail({
      g1: treeWithHeaders('Alice', 'Bob'),
      g2: treeWithHeaders('Carol', 'Dan'),
    });
    fireEvent.click(screen.getByText('Carol – Dan'));
    expect(props.onSelectGame).toHaveBeenCalledWith('g2');
  });

  it('marks a setup game with the position chip instead of an eval badge', () => {
    renderRail({ g1: treeWithHeaders('Lucena study', '', true) });
    expect(screen.getByText('position')).toBeInTheDocument();
  });

  it('keeps the rail header fixed and the list scrollable (ADR-0032 acceptance)', () => {
    const many: Record<string, ReturnType<typeof treeWithHeaders>> = {};
    for (let i = 0; i < 20; i++) {
      many[`g${i}`] = treeWithHeaders(`White ${i}`, `Black ${i}`);
    }
    renderRail(many);
    const list = screen.getByTestId('games-rail-list');
    expect(list.className).toContain('xl:overflow-y-auto');
    expect(screen.getByText(/Boards · 20/)).toBeInTheDocument();
  });

  it('hides import/new actions from read-only viewers', () => {
    renderRail({ g1: treeWithHeaders('Alice', 'Bob') }, { canEdit: false });
    expect(screen.queryByRole('button', { name: 'Import games' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New game' })).toBeNull();
  });

  it('removes a game via its row button without selecting it', () => {
    const { props } = renderRail({
      g1: treeWithHeaders('Alice', 'Bob'),
      g2: treeWithHeaders('Carol', 'Dan'),
    });
    const removeButtons = screen.getAllByRole('button', { name: 'Remove from room' });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[1]);
    expect(props.onRemoveGame).toHaveBeenCalledWith('g2');
    // The remove click must not also select the game being removed.
    expect(props.onSelectGame).not.toHaveBeenCalled();
  });

  it('hides the remove button from read-only viewers', () => {
    renderRail({ g1: treeWithHeaders('Alice', 'Bob') }, { canEdit: false });
    expect(screen.queryByRole('button', { name: 'Remove from room' })).toBeNull();
  });
});
