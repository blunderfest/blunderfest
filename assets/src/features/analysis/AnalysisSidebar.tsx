import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowIcon from '@/components/ArrowIcon';
import { panel } from '@/components/ui';
import CriticalMoments from '@/features/analysis/CriticalMoments';
import EngineBox from '@/features/analysis/EngineBox';
import GameInfo from '@/features/analysis/GameInfo';
import GameReport from '@/features/analysis/GameReport';
import MoveList from '@/features/analysis/MoveList';
import type { Row } from '@/features/analysis/moveList';
import type { Entry } from '@/features/analysis/nodeMap';
import type { Opening, OpeningBook } from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import SidebarTabs from '@/features/analysis/SidebarTabs';
import type { EngineState } from '@/features/analysis/useEngine';
import type { usePositionEditor } from '@/features/analysis/usePositionEditor';
import type { GameNode, GameTree, LegalMove } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

/**
 * The room's one sidebar (ADR-0031, amended by ADR-0032): a single tabbed
 * column — Moves · Review · Chat. Moves = the engine box fused atop
 * the reference block (opening-book continuations for the viewed position,
 * ADR-0024 as amended) and the move list. Review = the whole-game list
 * views (Moments | Report) plus Game info as nested tabs. Chat arrives as
 * pre-built content from RoomView (its handlers live there); the active
 * tab is lifted to RoomView too, so it survives game switches and drives
 * the chat unread badge. Room chrome (code copy, leave, demo badge) is all
 * in the app bar now — there is no Room tab. The historical-examples
 * browser is a dialog from the board header (ADR-0030), not a tab.
 *
 * Pure presentation — the orchestrator owns the state; every handler
 * arrives as a prop. At xl the sidebar has a fixed height matching the
 * board column (the board is always 34rem there + ~7.5rem of chrome): a
 * definite height is what makes the move list scroll inside itself — a
 * stretched-only flex item grows with a long list and drags the whole
 * board row down the page.
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
  canEdit,
  canPlay,
  flipped,
  activeTab,
  onTabChange,
  chatTab,
  chatBadge,
  onNavigate,
  onPlayMove,
  onInsertLine,
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
  canEdit: boolean;
  canPlay: boolean;
  flipped: boolean;
  /** The active tab, lifted to RoomView (survives game switches). */
  activeTab: string;
  onTabChange: (id: string) => void;
  /** The Chat tab's content (absent in read-only rooms). */
  chatTab?: ReactNode;
  /** The unread badge on the Chat tab (RoomView owns the count). */
  chatBadge?: ReactNode;
  onNavigate: (nodeId: number) => void;
  onPlayMove: (move: LegalMove) => void;
  onInsertLine: (pv: string[]) => void;
  onReferenceGhost: (move: LegalMove | null) => void;
  onFlowSelect: (ply: number) => void;
  onToggleEngine: () => void;
  onToggleArrows: () => void;
  onEngineLines: (count: number) => void;
}) {
  const { t } = useTranslation();

  const noAnalysisNote = (
    <div className="grid h-full place-items-center p-4">
      <p className="m-0 text-note text-faint">{t('analysis.noAnalysisYet')}</p>
    </div>
  );

  const tabs = [
    {
      id: 'moves',
      label: t('analysis.moves'),
      content: (
        // One coherent panel: the engine section on top, the reference
        // block below it (the per-position opening-book continuations,
        // ADR-0024 as amended), then the move list scrolling below —
        // lichess's analysis panel.
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
          <ReferencePanel
            book={book}
            fen={current?.fen ?? null}
            onPlayMove={canPlay && !editor.editing ? onPlayMove : undefined}
            onHoverMove={onReferenceGhost}
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
      id: 'review',
      label: t('analysis.reviewTab'),
      content: (
        <section
          className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
          data-testid="viz-box"
          data-tour="viz-box"
        >
          <SidebarTabs
            tabs={[
              {
                id: 'moments',
                label: t('analysis.momentsTab'),
                content: (
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {hasAnalysis ? (
                      <CriticalMoments
                        tree={tree}
                        evals={mainlineEvals}
                        flipped={flipped}
                        onSelectPly={onFlowSelect}
                      />
                    ) : (
                      noAnalysisNote
                    )}
                  </div>
                ),
              },
              {
                id: 'report',
                label: t('analysis.reportTab'),
                content: (
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {hasAnalysis ? (
                      <GameReport
                        tree={tree}
                        evals={mainlineEvals}
                        opening={mainlineOpening}
                        onSelectPly={onFlowSelect}
                      />
                    ) : (
                      noAnalysisNote
                    )}
                  </div>
                ),
              },
              {
                id: 'game',
                label: t('room.gameInfo'),
                content: (
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <GameInfo tree={tree} />
                  </div>
                ),
              },
            ]}
          />
        </section>
      ),
    },
    ...(chatTab !== undefined
      ? [
          {
            id: 'chat',
            label: t('chat.title'),
            badge: chatBadge,
            content: (
              <section
                className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
                data-tour="chat-panel"
              >
                {chatTab}
              </section>
            ),
          },
        ]
      : []),
  ];

  return (
    <aside
      className="order-3 flex h-[52dvh] w-full max-w-[min(90vw,34rem)] flex-col gap-3 sm:h-[46dvh] xl:h-[calc(var(--board-size)+7.5rem)] xl:w-[360px] 2xl:w-[420px]"
      data-tour="sidebar"
      data-testid="room-sidebar"
    >
      <SidebarTabs tabs={tabs} activeId={activeTab} onActivate={onTabChange} />
    </aside>
  );
}
