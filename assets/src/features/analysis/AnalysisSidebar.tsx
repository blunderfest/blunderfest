import { useTranslation } from 'react-i18next';
import ArrowIcon from '@/components/ArrowIcon';
import { panel } from '@/components/ui';
import EngineBox from '@/features/analysis/EngineBox';
import GameInfo from '@/features/analysis/GameInfo';
import MoveList from '@/features/analysis/MoveList';
import type { Row } from '@/features/analysis/moveList';
import type { Entry } from '@/features/analysis/nodeMap';
import type { Opening, OpeningBook } from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import SidebarTabs from '@/features/analysis/SidebarTabs';
import type { EngineState } from '@/features/analysis/useEngine';
import type { usePositionEditor } from '@/features/analysis/usePositionEditor';
import VizBox from '@/features/analysis/VizBox';
import HistoricalEvidencePanel from '@/features/historicalEvidence/HistoricalEvidencePanel';
import type { GameNode, GameTree, LegalMove } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

/**
 * The analysis sidebar: the tabbed panel (Moves | Game info | Openings |
 * Historical evidence) plus the viz box (Moments | Report) pinned below.
 * Pure presentation — the orchestrator owns the state; every handler
 * arrives as a prop. The sidebar's height matches the board column's at
 * xl (board 34rem + the nav/controls/hints 13rem, measured) so a long
 * move list scrolls inside itself instead of stretching the page.
 */
export default function AnalysisSidebar({
  tree,
  current,
  book,
  byId,
  rows,
  engineState,
  engineOn,
  arrowsOn,
  engineLines,
  editor,
  evalsByPly,
  evalsByNodeId,
  bestMoves,
  bookExitPly,
  mainlineEvals,
  hasAnalysis,
  mainlineOpening,
  engineAnalyze,
  linePath,
  linePathText,
  routeToCurrent,
  canEdit,
  canPlay,
  flipped,
  onNavigate,
  onPlayMove,
  onInsertLine,
  onAddHistoricalVariation,
  onAddHistoricalGame,
  onReferenceGhost,
  onFlowSelect,
  onToggleEngine,
  onToggleArrows,
  onEngineLines,
}: {
  tree: GameTree;
  current: GameNode;
  book: OpeningBook | null;
  byId: Map<number, Entry>;
  rows: Row[];
  engineState: EngineState;
  engineOn: boolean;
  arrowsOn: boolean;
  engineLines: number;
  editor: ReturnType<typeof usePositionEditor>;
  evalsByPly: Record<number, AnalysisEval>;
  evalsByNodeId: Map<number, AnalysisEval>;
  bestMoves: Map<number, string>;
  bookExitPly: number | null;
  mainlineEvals: AnalysisEval[];
  hasAnalysis: boolean;
  mainlineOpening: Opening | null;
  engineAnalyze: {
    label: string;
    progress: { done: number; total: number } | null;
    onClick: () => void;
  } | null;
  linePath: { nodes: GameNode[]; branchId: number } | null;
  linePathText: string | null;
  routeToCurrent: string[] | null;
  canEdit: boolean;
  canPlay: boolean;
  flipped: boolean;
  onNavigate: (nodeId: number) => void;
  onPlayMove: (move: LegalMove) => void;
  onInsertLine: (pv: string[]) => void;
  onAddHistoricalVariation: (fen: string, sans: string[], exact: boolean) => void;
  onAddHistoricalGame?: (tree: GameTree, ply: number) => void;
  onReferenceGhost: (move: LegalMove | null) => void;
  onFlowSelect: (ply: number) => void;
  onToggleEngine: () => void;
  onToggleArrows: () => void;
  onEngineLines: (count: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <aside className="order-3 flex w-full max-w-[min(100%,24rem)] flex-col gap-3 xl:h-[calc(min(90vw,34rem)+13rem)] xl:w-[340px]">
      <SidebarTabs
        tabs={[
          {
            id: 'analysis',
            label: t('analysis.moves'),
            content: (
              // One coherent panel: the engine section on top, the move
              // list scrolling below — lichess's analysis panel.
              <section
                className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
                data-tour="analysis-panel"
              >
                <EngineBox
                  fen={current.fen ?? ''}
                  state={engineState}
                  engineOn={engineOn}
                  arrowsOn={arrowsOn}
                  linesCount={engineLines}
                  paused={editor.editing}
                  onToggleEngine={onToggleEngine}
                  onToggleArrows={onToggleArrows}
                  onLinesCount={onEngineLines}
                  onInsertLine={canEdit && !editor.editing ? onInsertLine : undefined}
                  analyze={engineAnalyze}
                />
                {linePath !== null && linePathText !== null && (
                  // Off-mainline bearings: the path from the branch
                  // point; clicking returns to it.
                  <button
                    type="button"
                    data-testid="line-path"
                    title={t('analysis.backToMainline')}
                    aria-label={t('analysis.backToMainline')}
                    className="flex shrink-0 items-center gap-1.5 border-t border-line px-3 py-1.5 text-left text-note text-muted transition-colors hover:bg-raised hover:text-ink"
                    onClick={() => {
                      if (linePath.branchId !== null) {
                        onNavigate(linePath.branchId);
                      }
                    }}
                  >
                    <ArrowIcon of="left" className="h-3 w-3 shrink-0" />
                    <span className="truncate tabular-nums">{linePathText}</span>
                  </button>
                )}
                <MoveList
                  rows={rows}
                  currentId={current.id}
                  onSelect={onNavigate}
                  evalsByPly={evalsByPly}
                  evalsByNodeId={evalsByNodeId}
                  parentOf={(id) => byId.get(id)?.parent ?? null}
                  bookExitPly={bookExitPly}
                  bestMoves={bestMoves}
                />
              </section>
            ),
          },
          {
            id: 'game',
            label: t('room.gameInfo'),
            content: <GameInfo tree={tree} />,
          },
          {
            id: 'reference',
            label: t('analysis.referenceTab'),
            content: (
              <section
                className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
              >
                <ReferencePanel
                  book={book}
                  fen={current?.fen ?? null}
                  onPlayMove={canPlay && !editor.editing ? onPlayMove : undefined}
                  onHoverMove={onReferenceGhost}
                />
              </section>
            ),
          },
          {
            id: 'history',
            label: t('evidence.tab'),
            content: (
              <section
                className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
              >
                <HistoricalEvidencePanel
                  fen={current?.fen ?? null}
                  route={routeToCurrent}
                  refPly={current?.ply ?? null}
                  canAnalyze={canEdit}
                  onAddGame={canEdit ? onAddHistoricalGame : undefined}
                  onAddVariation={canEdit ? onAddHistoricalVariation : undefined}
                />
              </section>
            ),
          },
        ]}
      />
      {/*
        The visualization box sits below the tabs so it stays visible no
        matter which tab is active. A constant height (h-44 + padding),
        so the move list never resizes — the charts stretch to fill it.
      */}
      <VizBox
        tree={tree}
        evals={mainlineEvals}
        hasAnalysis={hasAnalysis}
        opening={mainlineOpening}
        flipped={flipped}
        onSelectPly={onFlowSelect}
      />
    </aside>
  );
}
