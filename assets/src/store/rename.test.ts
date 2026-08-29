import { describe, expect, it } from 'vitest';
import { emptyGameTree } from '@/lib/api';
import { createRoomStore, selectGameEntries } from '@/store/roomStore';

function setGameOp(seq: number, gameId: string) {
  const tree = emptyGameTree();
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
