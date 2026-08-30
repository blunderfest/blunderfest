import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpPopover from '@/components/HelpPopover';
import { button } from '@/components/ui';
import ActivityFlow from '@/features/analysis/ActivityFlow';
import ClocksFlow from '@/features/analysis/ClocksFlow';
import GameFlow from '@/features/analysis/GameFlow';
import MaterialFlow, { type CapturePoint } from '@/features/analysis/MaterialFlow';
import { moveTimes } from '@/features/analysis/moveTimes';
import RemainingClocksFlow from '@/features/analysis/RemainingClocksFlow';
import type { GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const ACTIVE_KEY = 'blunderfest.timelineActiveLayer';
const DEFAULT_LAYER = 'eval';
/** The strip's single chart height. */
const STRIP_HEIGHT = 'h-24';

function readActiveLayer(): string {
  return localStorage.getItem(ACTIVE_KEY) ?? DEFAULT_LAYER;
}

/**
 * The whole-game timeline band (ADR-0024, as amended; ADR-0031; now tabbed
 * and docked per ADR-0034): the game-story charts — eval, material, activity,
 * clocks — as ONE chart at a time, switched by a tab row in the header. The
 * strip is a fixed bottom region of the board column (the rail and dock run
 * full height beside it); it is not collapsible. Scrub-to-ply on the chart
 * navigates; the gold current-position marker rides the chart. The active
 * layer persists per viewer in localStorage, never as ops. The whole-game
 * analyze job owns the header — Analyze game, live progress, Re-analyze —
 * always reachable.
 */
export default function TimelineBand({
  tree,
  evals,
  currentPly,
  flipped = false,
  openingExitPly = null,
  endgameStartPly = null,
  captures = [],
  bestMoves,
  spanPly,
  hasAnalysis,
  analyzeAction,
  onSelectPly,
}: {
  tree: GameTree;
  evals: AnalysisEval[];
  currentPly: number;
  flipped?: boolean;
  openingExitPly?: number | null;
  endgameStartPly?: number | null;
  captures?: CapturePoint[];
  bestMoves?: Map<number, string>;
  spanPly: number;
  hasAnalysis: boolean;
  /** The whole-game analyze action, shown in the header until a job ran. */
  analyzeAction: {
    label: string;
    progress: { done: number; total: number } | null;
    onClick: () => void;
  } | null;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const [activeLayer, setActiveLayer] = useState<string>(readActiveLayer);

  function chooseLayer(id: string) {
    setActiveLayer(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  /** A layer's empty-state note, at the height it renders at. */
  const placeholder = (copy: string, heightClass: string) => (
    <div className={`grid ${heightClass} place-items-center`}>
      <p className="m-0 text-note text-faint">{copy}</p>
    </div>
  );

  /** The time-left layer's side legend: solid line = White, dashed = Black. */
  const remainingLegend = (
    <span className="flex items-center gap-2 text-micro font-semibold text-faint">
      <span className="flex items-center gap-1">
        <span className="h-0.5 w-3 rounded-full bg-clock-w" aria-hidden="true" />
        {t('analysis.white')}
      </span>
      <span className="flex items-center gap-1">
        <span
          className="h-0.5 w-3 rounded-full border-t border-dashed border-[#b6bdcc]"
          aria-hidden="true"
        />
        {t('analysis.black')}
      </span>
    </span>
  );

  const hasMoves = tree.mainline_ply_count > 0;
  const hasClocks = moveTimes(tree).length > 0;

  const layers: {
    id: string;
    label: string;
    legend?: ReactNode;
    hasData: boolean;
    chart: (heightClass: string, compact: boolean) => ReactNode;
    /** Why the layer is empty, for its placeholders. */
    emptyCopy: string;
  }[] = [
    {
      id: 'eval',
      label: t('analysis.evalTab'),
      hasData: hasAnalysis,
      chart: (heightClass, compact) => (
        <GameFlow
          evals={evals}
          currentPly={currentPly}
          flipped={flipped}
          openingExitPly={openingExitPly}
          endgameStartPly={endgameStartPly}
          captures={captures}
          bestMoves={bestMoves}
          spanPly={spanPly}
          heightClass={heightClass}
          compact={compact}
          onSelectPly={onSelectPly}
        />
      ),
      // The action lives in the header; the layer just explains itself.
      emptyCopy: t('analysis.noAnalysisYet'),
    },
    {
      id: 'material',
      label: t('analysis.materialTab'),
      hasData: hasMoves,
      chart: (heightClass) => (
        <MaterialFlow
          tree={tree}
          currentPly={currentPly}
          flipped={flipped}
          spanPly={spanPly}
          heightClass={heightClass}
          onSelectPly={onSelectPly}
        />
      ),
      emptyCopy: t('analysis.materialEmpty'),
    },
    {
      id: 'activity',
      label: t('analysis.activityTab'),
      hasData: hasMoves,
      chart: (heightClass) => (
        <ActivityFlow
          tree={tree}
          currentPly={currentPly}
          flipped={flipped}
          spanPly={spanPly}
          heightClass={heightClass}
          onSelectPly={onSelectPly}
        />
      ),
      emptyCopy: t('analysis.activityEmpty'),
    },
    {
      id: 'think',
      label: t('analysis.thinkTab'),
      hasData: hasClocks,
      chart: (heightClass) => (
        <ClocksFlow
          tree={tree}
          currentPly={currentPly}
          spanPly={spanPly}
          heightClass={heightClass}
          onSelectPly={onSelectPly}
        />
      ),
      emptyCopy: t('analysis.clocksEmpty'),
    },
    {
      id: 'remaining',
      label: t('analysis.remainingTab'),
      legend: remainingLegend,
      hasData: hasClocks,
      chart: (heightClass) => (
        <RemainingClocksFlow
          tree={tree}
          currentPly={currentPly}
          spanPly={spanPly}
          heightClass={heightClass}
          onSelectPly={onSelectPly}
        />
      ),
      emptyCopy: t('analysis.clocksEmpty'),
    },
  ];

  const active = layers.find((layer) => layer.id === activeLayer) ?? layers[0];

  return (
    <section
      className="w-full border-line border-t bg-panel"
      data-tour="timeline-band"
      data-testid="timeline-band"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {/*
            One chart at a time: the tab row picks it. A dataless layer's tab
            stays selectable — its chart explains itself in place.
          */}
          <div
            role="tablist"
            aria-label={t('analysis.timelineLayers')}
            className="flex items-stretch"
          >
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                role="tab"
                aria-selected={active.id === layer.id}
                data-testid="timeline-layer-tab"
                data-layer={layer.id}
                className={`relative px-2 py-1 text-note font-semibold uppercase tracking-wide transition-colors ${
                  active.id === layer.id ? 'text-gold-hi' : 'text-faint hover:text-muted'
                }`}
                onClick={() => chooseLayer(layer.id)}
              >
                {layer.label}
                {active.id === layer.id && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-0.5 bg-gold-hi"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {active.legend}
          {analyzeAction !== null && (
            <>
              <button
                type="button"
                id="analyze-game-button"
                className={button({ intent: 'quiet', size: 'xs' })}
                disabled={analyzeAction.progress !== null}
                onClick={analyzeAction.onClick}
              >
                {analyzeAction.label}
              </button>
              {/* The analyze job's progress — a fill under the header, not a
                  number: it sweeps while it runs (v0's strip header model). */}
              {analyzeAction.progress !== null && (
                <span
                  role="progressbar"
                  aria-label={t('room.analyzing', {
                    done: analyzeAction.progress.done,
                    total: analyzeAction.progress.total,
                  })}
                  data-testid="analyze-progress-bar"
                  className="relative h-1.5 w-16 overflow-hidden rounded-full bg-line"
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-gold transition-[width] duration-300"
                    style={{
                      width: `${Math.round(
                        (analyzeAction.progress.done / Math.max(analyzeAction.progress.total, 1)) *
                          100,
                      )}%`,
                    }}
                  />
                </span>
              )}
            </>
          )}
          <HelpPopover label={t('analysis.aboutAnalyzeGame')}>
            <p className="m-0 text-note text-muted">{t('analysis.helpAnalyzeGameBody')}</p>
          </HelpPopover>
        </div>
      </div>
      <div className="p-2" data-testid={`timeline-layer-${active.id}`}>
        {active.hasData
          ? active.chart(STRIP_HEIGHT, false)
          : placeholder(active.emptyCopy, STRIP_HEIGHT)}
      </div>
    </section>
  );
}
