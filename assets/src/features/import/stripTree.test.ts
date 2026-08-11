import { describe, expect, it } from 'vitest';
import {
  countVariations,
  DEFAULT_STRIP,
  hasComments,
  hasEvaluations,
  stripTree,
} from '@/features/import/stripTree';
import type { GameNode, GameTree } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

/**
 * 1. e4 {[%eval 0.3] [%clk 0:05:00] Sharp.} e5! with a variation
 * 1... c5 {The Sicilian.} — engine data and human text mixed.
 */
function fixture(): GameTree {
  const variation = node({
    id: 3,
    ply: 2,
    san: 'c5',
    from: 'c7',
    to: 'c5',
    comment: 'The Sicilian.',
  });
  const mainline = node({
    id: 2,
    ply: 2,
    san: 'e5',
    from: 'e7',
    to: 'e5',
    nags: [1],
    comment: '[%eval -0.2] Brave.',
  });
  const first = node({
    id: 1,
    ply: 1,
    san: 'e4',
    comment: '[%eval 0.3] [%clk 0:05:00] Sharp.',
    children: [mainline, variation],
  });
  return {
    headers: { White: 'Anna', Black: 'Boris', Event: 'Friendly' },
    result: '1-0',
    setup: null,
    root: node({ id: 0, ply: 0, san: null, from: null, to: null, children: [first] }),
    mainline_ply_count: 2,
    node_count: 4,
  };
}

describe('stripTree', () => {
  it('removes only engine annotations by default, keeping human text', () => {
    const stripped = stripTree(fixture(), DEFAULT_STRIP);
    const first = stripped.root.children[0];
    expect(first.comment).toBe('Sharp.');
    expect(first.children[0].comment).toBe('Brave.');
    expect(first.children[1].comment).toBe('The Sicilian.');
    // NAGs, variations, and headers survive the default.
    expect(first.children[0].nags).toEqual([1]);
    expect(first.children).toHaveLength(2);
    expect(stripped.headers.White).toBe('Anna');
  });

  it('drops a comment that held only command markers', () => {
    const game = fixture();
    game.root.children[0].comment = '[%eval 0.3] [%clk 0:05:00]';
    const stripped = stripTree(game, DEFAULT_STRIP);
    expect(stripped.root.children[0].comment).toBeNull();
  });

  it('removes comments and NAGs when comments are stripped', () => {
    const stripped = stripTree(fixture(), { ...DEFAULT_STRIP, comments: true });
    const first = stripped.root.children[0];
    expect(first.comment).toBeNull();
    expect(first.children[0].comment).toBeNull();
    expect(first.children[1].comment).toBeNull();
    expect(first.children[0].nags).toEqual([]);
    expect(first.children).toHaveLength(2);
  });

  it('removes headers when metadata is stripped, keeping the result', () => {
    const stripped = stripTree(fixture(), { ...DEFAULT_STRIP, metadata: true });
    expect(stripped.headers).toEqual({});
    expect(stripped.result).toBe('1-0');
  });

  it('keeps only the mainline when variations are stripped, recomputing the node count', () => {
    const stripped = stripTree(fixture(), { ...DEFAULT_STRIP, variations: true });
    const first = stripped.root.children[0];
    expect(first.children).toHaveLength(1);
    expect(first.children[0].san).toBe('e5');
    expect(stripped.node_count).toBe(3);
    expect(stripped.mainline_ply_count).toBe(2);
  });

  it('detects engine annotations and human comments separately', () => {
    const game = fixture();
    expect(hasEvaluations(game.root)).toBe(true);
    expect(hasComments(game.root)).toBe(true);

    const noComments = stripTree(game, { ...DEFAULT_STRIP, comments: true });
    expect(hasComments(noComments.root)).toBe(false);

    const noEvals = stripTree(game, DEFAULT_STRIP);
    expect(hasEvaluations(noEvals.root)).toBe(false);
  });

  it('counts variations', () => {
    expect(countVariations(fixture().root)).toBe(1);
    expect(countVariations(stripTree(fixture(), { ...DEFAULT_STRIP, variations: true }).root)).toBe(
      0,
    );
  });
});
