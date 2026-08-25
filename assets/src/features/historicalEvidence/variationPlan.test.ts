import { describe, expect, it } from 'vitest';
import { planHistoricalVariation } from '@/features/historicalEvidence/variationPlan';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('planHistoricalVariation', () => {
  it('plans a plain line for exact candidates, from the current position', () => {
    const plan = planHistoricalVariation({
      exact: true,
      currentId: 7,
      maxNodeId: 20,
      currentFen: START,
      candidateFen: START,
      sans: ['e4', 'e5'],
    });

    expect(plan).toEqual({
      kind: 'line',
      parentId: 7,
      moves: [
        expect.objectContaining({ san: 'e4', from: 'e2', to: 'e4' }),
        expect.objectContaining({ san: 'e5', from: 'e7', to: 'e5' }),
      ],
    });
  });

  it('plans a setup child plus line for non-exact candidates', () => {
    const candidateFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

    const plan = planHistoricalVariation({
      exact: false,
      currentId: 5,
      maxNodeId: 20,
      currentFen: START,
      candidateFen,
      sans: ['c5', 'Nf3'],
    });

    expect(plan).toEqual({
      kind: 'setup_line',
      setup: { parentId: 5, fen: candidateFen },
      line: {
        parentId: 21, // the deterministic setup node id: max id + 1
        moves: [
          expect.objectContaining({ san: 'c5', from: 'c7', to: 'c5' }),
          expect.objectContaining({ san: 'Nf3', from: 'g1', to: 'f3' }),
        ],
      },
    });
  });

  it('returns null when no move resolves', () => {
    expect(
      planHistoricalVariation({
        exact: true,
        currentId: 0,
        maxNodeId: 0,
        currentFen: START,
        candidateFen: START,
        sans: ['Qz9'],
      }),
    ).toBeNull();
  });

  it('truncates the line at the first unresolvable move', () => {
    const plan = planHistoricalVariation({
      exact: true,
      currentId: 0,
      maxNodeId: 0,
      currentFen: START,
      candidateFen: START,
      sans: ['e4', 'e5', 'Qz9'],
    });

    expect(plan?.kind).toBe('line');
    if (plan?.kind === 'line') {
      expect(plan.moves).toHaveLength(2);
    }
  });
});
