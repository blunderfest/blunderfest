import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpPopover from '@/components/HelpPopover';
import { button, panel } from '@/components/ui';
import ActivityFlow from '@/features/analysis/ActivityFlow';
import ClocksFlow from '@/features/analysis/ClocksFlow';
import GameFlow from '@/features/analysis/GameFlow';
import MaterialFlow, { type CapturePoint } from '@/features/analysis/MaterialFlow';
import type { GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const STORAGE_KEY = 'blunderfest.timelineLayers';
/** Eval pairs with material; the others join on demand. */
const DEFAULT_LAYERS = ['eval', 'material'];
/** The timeline band's layer height: compact — the layers stack (ADR-0024). */
const LAYER_HEIGHT = 'h-36';

/** Each layer's identifying hue — its chip dot, caption dot and chart fill. */
const LAYER_DOTS = {
  eval: 'bg-[#f4f6fb]',
  material: 'bg-[#b6bdcc]',
  activity: 'bg-[#6ea8fe]',
  // Half white, half silver: the clocks layer charts both sides.
  clocks: 'bg-[linear-gradient(90deg,#f4f6fb_50%,#b6bdcc_50%)]',
} as const;

function readVisibleLayers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
        return parsed;
      }
    }
  } catch {
    // A corrupt stored value falls back to the defaults.
  }
  return DEFAULT_LAYERS;
}

/**
 * The whole-game timeline band (ADR-0024, as amended): the game-story
 * charts — eval, material, activity, clocks — stacked as layers on one
 * shared move axis (visualization ideas §16), full width under the board.
 * Every layer is captioned and hue-coded (its dot matches its chart fill),
 * uses the same span and the same scrub-to-ply gesture, so the gold
 * current-position marker walks the layers together. Layer toggles are
 * legend chips (dot + label) persisting in localStorage; new whole-game
 * timelines join as layers here, never as sidebar tabs. The whole-game
 * analyze job owns the band header — Analyze game, live progress, and
 * Re-analyze when the mainline outgrew it — always reachable, whatever
 * layers are on. The eval chip wears a needs-analysis marker until the
 * job has run (the other layers need no analysis).
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
  const [visible, setVisible] = useState<string[]>(readVisibleLayers);

  function toggleLayer(id: string) {
    setVisible((current) => {
      const next = current.includes(id)
        ? current.filter((layer) => layer !== id)
        : [...current, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const noMoves = (copy: string) => (
    <div className="grid h-36 place-items-center">
      <p className="m-0 text-note text-faint">{copy}</p>
    </div>
  );

  /** The clocks layer's side legend: whose bar is which color. */
  const clocksLegend = (
    <span className="flex items-center gap-2 text-micro font-semibold text-faint">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-[2px] bg-[#f4f6fb]" aria-hidden="true" />
        {t('analysis.white')}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-[2px] bg-[#b6bdcc]" aria-hidden="true" />
        {t('analysis.black')}
      </span>
    </span>
  );

  const layers: {
    id: string;
    label: string;
    dot: string;
    legend?: ReactNode;
    content: ReactNode;
  }[] = [
    {
      id: 'eval',
      label: t('analysis.evalTab'),
      dot: LAYER_DOTS.eval,
      content: hasAnalysis ? (
        <GameFlow
          evals={evals}
          currentPly={currentPly}
          flipped={flipped}
          openingExitPly={openingExitPly}
          endgameStartPly={endgameStartPly}
          captures={captures}
          bestMoves={bestMoves}
          spanPly={spanPly}
          heightClass={LAYER_HEIGHT}
          onSelectPly={onSelectPly}
        />
      ) : (
        // The action lives in the header; the layer just explains itself.
        <div className="grid h-36 place-items-center">
          <p className="m-0 text-note text-faint">{t('analysis.noAnalysisYet')}</p>
        </div>
      ),
    },
    {
      id: 'material',
      label: t('analysis.materialTab'),
      dot: LAYER_DOTS.material,
      content:
        tree.mainline_ply_count > 0 ? (
          <MaterialFlow
            tree={tree}
            currentPly={currentPly}
            flipped={flipped}
            spanPly={spanPly}
            heightClass={LAYER_HEIGHT}
            onSelectPly={onSelectPly}
          />
        ) : (
          noMoves(t('analysis.materialEmpty'))
        ),
    },
    {
      id: 'activity',
      label: t('analysis.activityTab'),
      dot: LAYER_DOTS.activity,
      content:
        tree.mainline_ply_count > 0 ? (
          <ActivityFlow
            tree={tree}
            currentPly={currentPly}
            flipped={flipped}
            spanPly={spanPly}
            heightClass={LAYER_HEIGHT}
            onSelectPly={onSelectPly}
          />
        ) : (
          noMoves(t('analysis.activityEmpty'))
        ),
    },
    {
      id: 'clocks',
      label: t('analysis.clocksTab'),
      dot: LAYER_DOTS.clocks,
      legend: clocksLegend,
      content: (
        <ClocksFlow
          tree={tree}
          currentPly={currentPly}
          spanPly={spanPly}
          heightClass={LAYER_HEIGHT}
          onSelectPly={onSelectPly}
        />
      ),
    },
  ];

  const visibleLayers = layers.filter((layer) => visible.includes(layer.id));

  return (
    <section
      className={`${panel({ layout: 'none', pad: 'none' })} w-full`}
      data-tour="timeline-band"
      data-testid="timeline-band"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-line px-2 py-1">
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">{t('analysis.timelineLayers')}</legend>
          <div className="flex flex-wrap items-center gap-1">
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                className={`inline-flex items-center gap-1 rounded-chip border px-1.5 py-0.5 font-semibold text-[10px] transition-colors ${
                  visible.includes(layer.id)
                    ? 'border-line-strong bg-raised text-ink'
                    : 'border-line text-muted hover:text-ink'
                }`}
                aria-pressed={visible.includes(layer.id)}
                data-testid="timeline-layer-toggle"
                data-layer={layer.id}
                title={
                  layer.id === 'eval' && !hasAnalysis ? t('analysis.evalNeedsAnalysis') : undefined
                }
                onClick={() => toggleLayer(layer.id)}
              >
                {/* The dot is the legend: the layer's chart hue, on or off. */}
                <span
                  className={`h-2 w-2 shrink-0 rounded-[2px] ${layer.dot}`}
                  aria-hidden="true"
                />
                {layer.label}
                {layer.id === 'eval' && !hasAnalysis && (
                  // The one layer that needs an analysis: a quiet gold
                  // marker until the whole-game job has run.
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                    aria-hidden="true"
                    data-testid="eval-layer-needs-analysis"
                  />
                )}
              </button>
            ))}
          </div>
        </fieldset>
        {analyzeAction !== null && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              id="analyze-game-button"
              className={button({ intent: 'quiet', size: 'xs' })}
              disabled={analyzeAction.progress !== null}
              onClick={analyzeAction.onClick}
            >
              {analyzeAction.progress !== null
                ? t('room.analyzing', {
                    done: analyzeAction.progress.done,
                    total: analyzeAction.progress.total,
                  })
                : analyzeAction.label}
            </button>
            <HelpPopover label={t('analysis.aboutAnalyzeGame')}>
              <p className="m-0 text-note text-muted">{t('analysis.helpAnalyzeGameBody')}</p>
            </HelpPopover>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-2">
        {visibleLayers.map((layer) => (
          <div key={layer.id} data-testid={`timeline-layer-${layer.id}`}>
            {/*
              The persistent caption: a chart is never anonymous, however
              deep it sits in the stack — the dot repeats its chip hue.
            */}
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                <span
                  className={`h-2 w-2 shrink-0 rounded-[2px] ${layer.dot}`}
                  aria-hidden="true"
                />
                {layer.label}
              </span>
              {layer.legend}
            </div>
            {layer.content}
          </div>
        ))}
        {visibleLayers.length === 0 && (
          <div className="grid h-20 place-items-center" data-testid="timeline-band-empty">
            <p className="m-0 text-note text-faint">{t('analysis.timelineAllOff')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
