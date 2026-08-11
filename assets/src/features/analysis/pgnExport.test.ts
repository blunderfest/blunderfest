import { describe, expect, it } from 'vitest';
import { gameToPgn } from '@/features/analysis/pgnExport';
import type { GameNode, GameTree } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

function node(partial: Partial<GameNode> & { id: number }): GameNode {
  return {
    ply: 1,
    san: 'e4',
    from: 'e2',
    to: 'e4',
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: START_FEN,
    children: [],
    ...partial,
  };
}

function tree(headers: Record<string, string>, root: GameNode, result = '1-0'): GameTree {
  return {
    headers,
    result,
    setup: null,
    root,
    mainline_ply_count: 0,
    node_count: 0,
  };
}

describe('gameToPgn', () => {
  it('exports headers, movetext, comments and variations', () => {
    const root = node({
      id: 0,
      ply: 0,
      san: null,
      from: null,
      to: null,
      children: [
        node({
          id: 1,
          ply: 1,
          san: 'e4',
          children: [
            node({
              id: 2,
              ply: 2,
              san: 'e5',
              from: 'e7',
              to: 'e5',
              children: [
                node({
                  id: 3,
                  ply: 3,
                  san: 'Nf3',
                  from: 'g1',
                  to: 'f3',
                  comment: 'Developing.',
                  children: [
                    node({ id: 4, ply: 4, san: 'Nc6', from: 'b8', to: 'c6' }),
                    node({
                      id: 5,
                      ply: 4,
                      san: 'Nf6',
                      from: 'g8',
                      to: 'f6',
                      comment: 'The Berlin.',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    expect(gameToPgn(tree({ White: 'Anna', Black: 'Boris' }, root))).toBe(
      '[White "Anna"]\n' +
        '[Black "Boris"]\n' +
        '[Result "1-0"]\n' +
        '\n' +
        '1. e4 e5 2. Nf3 {Developing.} 2... Nc6 (2... Nf6 {The Berlin.}) 1-0\n',
    );
  });

  it('writes NAGs and escapes braces in comments', () => {
    const root = node({
      id: 0,
      ply: 0,
      san: null,
      from: null,
      to: null,
      children: [
        node({
          id: 1,
          ply: 1,
          san: 'e4',
          nags: [1],
          comment: 'A } brace',
        }),
      ],
    });

    const pgn = gameToPgn(tree({}, root, '*'));
    expect(pgn).toContain('1. e4 $1 {A \\} brace} *');
  });

  it('restarts numbering for a black-to-move start', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const root = node({
      id: 0,
      ply: 1,
      san: null,
      from: null,
      to: null,
      fen,
      children: [node({ id: 1, ply: 2, san: 'e5', from: 'e7', to: 'e5' })],
    });
    const game = tree({}, root, '*');
    game.setup = { fen };

    const pgn = gameToPgn(game);
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(`[FEN "${fen}"]`);
    expect(pgn).toContain('1... e5 *');
  });

  it('exports a setup continuation as its own game with SetUp/FEN headers', () => {
    const setup = node({
      id: 2,
      ply: 1,
      san: null,
      from: null,
      to: null,
      fen: AFTER_E4_FEN,
      children: [node({ id: 3, ply: 2, san: 'd5', from: 'd7', to: 'd5' })],
    });
    const root = node({
      id: 0,
      ply: 0,
      san: null,
      from: null,
      to: null,
      children: [node({ id: 1, ply: 1, san: 'e4', children: [setup] })],
    });

    const pgn = gameToPgn(tree({ White: 'Anna', Black: 'Boris' }, root, '*'));

    // The main game carries the inline marker...
    expect(pgn).toContain(`1. e4 {[FEN "${AFTER_E4_FEN}"]} *`);
    // ...and the continuation follows as a second game.
    expect(pgn).toContain('[Event "Analysis of Anna vs Boris"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(`[FEN "${AFTER_E4_FEN}"]`);
    expect(pgn).toContain('1... d5 *');
    expect(pgn.indexOf('[Event "Analysis')).toBeGreaterThan(pgn.indexOf('1. e4'));
  });
});
