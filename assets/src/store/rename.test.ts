import { describe, expect, it } from 'vitest';
import { emptyGameTree } from '@/lib/api';
import { createRoomStore, selectGameEntries, selectNextGameNumber } from '@/store/roomStore';

function setGameOp(seq: number, gameId: string, title?: string) {
  const tree =
    title === undefined ? emptyGameTree() : { ...emptyGameTree(), headers: { Title: title } };
  return {
    seq,
    author: 'profile-1',
    ts: 't',
    type: 'set_game' as const,
    payload: { game_id: gameId, tree },
  };
}

describe('rename_game fold', () => {
  it('applies a rename: Title header updated in the stored tree', () => {
    const store = createRoomStore('abc12');
    store.send(setGameOp(1, 'game-1'));
    store.send({
      seq: 2,
      author: 'profile-1',
      ts: 't',
      type: 'rename_game',
      payload: { game_id: 'game-1', title: 'Custom name' },
    });
    const entries = store.getSnapshot().context.games['game-1'];
    expect(entries.headers.Title).toBe('Custom name');
  });
});

describe('selectGameEntries', () => {
  it('returns games in set_game seq order', () => {
    const store = createRoomStore('abc12');
    store.send(setGameOp(1, 'first'));
    store.send(setGameOp(2, 'second'));
    const ids = selectGameEntries(store.getSnapshot().context).map(([id]) => id);
    expect(ids).toEqual(['first', 'second']);
  });

  it('skips removed games', () => {
    const store = createRoomStore('abc12');
    store.send(setGameOp(1, 'first'));
    store.send(setGameOp(2, 'second'));
    store.send({
      seq: 3,
      author: 'profile-1',
      ts: 't',
      type: 'remove_game',
      payload: { game_id: 'first' },
    });
    const ids = selectGameEntries(store.getSnapshot().context).map(([id]) => id);
    expect(ids).toEqual(['second']);
  });
});

describe('selectNextGameNumber', () => {
  it('starts at 1 with no numbered titles yet', () => {
    const store = createRoomStore('abc12');
    expect(selectNextGameNumber(store.getSnapshot().context, 'Game')).toBe(1);
  });

  it('counts max numbered title across the full log, incl. removed games', () => {
    const store = createRoomStore('abc12');
    store.send(setGameOp(1, 'g1', 'Game 1'));
    store.send(setGameOp(2, 'g2', 'Game 2'));
    // Remove Game 1 — the counter stays pinned by the log entry.
    store.send({
      seq: 3,
      author: 'profile-1',
      ts: 't',
      type: 'remove_game',
      payload: { game_id: 'g1' },
    });
    expect(selectNextGameNumber(store.getSnapshot().context, 'Game')).toBe(3);
  });

  it('ignores titles that do not match the label exactly (no "Game & text" or pgn events)', () => {
    const store = createRoomStore('abc12');
    store.send(setGameOp(1, 'g1', 'Game 1-ish'));
    store.send(setGameOp(2, 'g2'));
    expect(selectNextGameNumber(store.getSnapshot().context, 'Game')).toBe(1);
  });

  it('explicitly typed numbers still bump the counter (the user picked that number)', () => {
    const store = createRoomStore('abc12');
    store.send(setGameOp(1, 'g1', 'Game 2'));
    expect(selectNextGameNumber(store.getSnapshot().context, 'Game')).toBe(3);
  });
});
