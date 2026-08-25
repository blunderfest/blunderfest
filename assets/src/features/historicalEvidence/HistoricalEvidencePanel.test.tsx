import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoricalEvidencePanel from '@/features/historicalEvidence/HistoricalEvidencePanel';
import type { HistoricalEvidenceResult } from '@/features/historicalEvidence/types';

vi.mock('@/lib/api', () => ({
  analyzeHistoricalEvidence: vi.fn(),
}));

import { analyzeHistoricalEvidence } from '@/lib/api';

const mockAnalyze = vi.mocked(analyzeHistoricalEvidence);

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const result: HistoricalEvidenceResult = {
  reference: { fen: START, occurrences: 11, games: 8, families: [] },
  candidates: [],
  timings: { candidates_ms: 1, menu_ms: 1, evidence_ms: 1, total_ms: 3 },
};

function renderPanel(props?: {
  fen?: string | null;
  route?: string[] | null;
  refPly?: number | null;
}) {
  const fen = props?.fen === undefined ? START : props.fen;
  return render(
    <HistoricalEvidencePanel
      fen={fen}
      route={props?.route === undefined ? null : props.route}
      refPly={props?.refPly === undefined ? null : props.refPly}
    />,
  );
}

describe('HistoricalEvidencePanel', () => {
  beforeEach(() => {
    mockAnalyze.mockReset();
    mockAnalyze.mockResolvedValue(result);
  });

  it('runs the analysis on demand and shows the example count', async () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith(START, { route: undefined, refPly: undefined });
    });
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
  });

  it('passes the route and refPly of the user game', async () => {
    renderPanel({ route: ['e4', 'e5'], refPly: 2 });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith(START, { route: ['e4', 'e5'], refPly: 2 });
    });
  });

  it('shows the empty state when there is no game', () => {
    renderPanel({ fen: null });

    expect(screen.queryByTestId('historical-evidence-run')).toBeDisabled();
  });

  it('is disabled in read-only rooms (the demo rule)', async () => {
    render(<HistoricalEvidencePanel fen={START} route={null} refPly={null} canAnalyze={false} />);

    expect(screen.getByTestId('historical-evidence-run')).toBeDisabled();
    expect(
      screen.getByText(
        'This room is read-only — historical analysis is available in rooms you can edit.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('surfaces errors and keeps them until retry', async () => {
    mockAnalyze.mockRejectedValue(new Error('boom'));

    renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    expect(await screen.findByText('The analysis failed — please try again.')).toBeInTheDocument();

    mockAnalyze.mockResolvedValue(result);
    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
  });

  it('does not re-run when the cursor moves — results are marked stale instead', async () => {
    const { rerender } = renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();

    rerender(
      <HistoricalEvidencePanel
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
        route={null}
        refPly={null}
      />,
    );

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('The position changed — run the analysis again to see examples for it.'),
    ).toBeInTheDocument();
  });
});
