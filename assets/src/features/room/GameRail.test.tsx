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

type Tree = ReturnType<typeof treeWithHeaders>;

function renderRail(games: Record<string, Tree> | [string, Tree][], over = {}) {
  const entries = Array.isArray(games) ? games : Object.entries(games);
  const props = {
    games: entries as [string, Tree][],
    activeGameId: 'g1',
    presenterGameId: null as string | null,
    canEdit: true,
    onSelectGame: vi.fn(),
    onAddGame: vi.fn(),
    onNewGame: vi.fn(),
    onRemoveGame: vi.fn(),
    onRenameGame: vi.fn(),
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

  it('derives stable numbered labels for untitled games (Game 1, Game 2)', () => {
    renderRail({
      g1: treeWithHeaders('', ''),
      g2: treeWithHeaders('Alice', 'Bob'),
      g3: treeWithHeaders('', ''),
    });
    expect(screen.getByText('Game 1')).toBeInTheDocument();
    expect(screen.getByText('Game 2')).toBeInTheDocument();
  });

  it('falls back to Event when there are no players or custom title', () => {
    const tree = treeWithHeaders('', '');
    tree.headers.Event = 'Blunder open';
    renderRail({ g1: tree });
    expect(screen.getByText('Blunder open')).toBeInTheDocument();
  });

  it('opens an inline editor on double-click and sends rename_game', () => {
    const { props } = renderRail({ g1: treeWithHeaders('Alice', 'Bob') });
    fireEvent.doubleClick(screen.getByText('Alice – Bob'));
    const input = screen.getByRole('textbox', { name: 'Rename game' });
    fireEvent.change(input, { target: { value: 'The immortal game' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameGame).toHaveBeenCalledWith('g1', 'The immortal game');
    expect(screen.queryByRole('textbox', { name: 'Rename game' })).toBeNull();
  });

  it('escape cancels editing without sending', () => {
    const { props } = renderRail({ g1: treeWithHeaders('Alice', 'Bob') });
    fireEvent.doubleClick(screen.getByText('Alice – Bob'));
    const input = screen.getByRole('textbox', { name: 'Rename game' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onRenameGame).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Rename game' })).toBeNull();
  });

  it('an empty rename clears the custom title back to derivations', () => {
    const tree = treeWithHeaders('Alice', 'Bob');
    tree.headers.Title = 'Old name';
    const { props } = renderRail({ g1: tree });
    fireEvent.doubleClick(screen.getByText('Old name'));
    const input = screen.getByRole('textbox', { name: 'Rename game' });
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameGame).toHaveBeenCalledWith('g1', '');
  });

  it('viewers never get the rename affordance', () => {
    renderRail({ g1: treeWithHeaders('Alice', 'Bob') }, { canEdit: false });
    fireEvent.doubleClick(screen.getByText('Alice – Bob'));
    expect(screen.queryByRole('textbox', { name: 'Rename game' })).toBeNull();
  });
});
