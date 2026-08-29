import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpPopover from '@/components/HelpPopover';
import { button, panel } from '@/components/ui';
import ActivityFlow from '@/features/analysis/ActivityFlow';
import ClocksFlow from '@/features/analysis/ClocksFlow';
import GameFlow from '@/features/analysis/GameFlow';
import MaterialFlow, { type CapturePoint } from '@/features/analysis/MaterialFlow';
import { moveTimes } from '@/features/analysis/moveTimes';
import type { GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const STORAGE_KEY = 'blunderfest.timelineLayers';
const EXPANDED_KEY = 'blunderfest.timelineExpanded';
const SPOTLIGHT_KEY = 'blunderfest.timelineSpotlight';
/** Eval pairs with material; the others join on demand. */
const DEFAULT_LAYERS = ['eval', 'material'];
/** The band's expanded layer height: compact — the layers stack (ADR-0024). */
const LAYER_HEIGHT = 'h-36';
/** The collapsed strip's sparkline height (ADR-0031). */
const STRIP_HEIGHT = 'h-10';

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

function readExpanded(): boolean {
  return localStorage.getItem(EXPANDED_KEY) === '1';
}

function readSpotlight(): string | null {
  return localStorage.getItem(SPOTLIGHT_KEY);
}

/**
 * The whole-game timeline band (ADR-0024, as amended; ADR-0031): the
 * game-story charts — eval, material, activity, clocks — stacked as layers
 * on one shared move axis (visualization ideas §16) under the board. Every
 * layer is captioned and hue-coded, uses the same span and the same
 * scrub-to-ply gesture, so the gold current-position marker walks the
 * layers together.
 *
 * The band is a **strip** by default: one sparkline-height layer (the first
 * enabled layer holding data) that stays scrubbable, with the layer toggles
 * in a "Layers" popover and an expand chevron for the full stack. Layers
 * with no data render nothing in the strip (the contract: empty states take
 * no space); the expanded stack keeps its per-layer placeholders so an
 * explicitly expanded band explains itself. Layer visibility and the
 * expanded state persist per viewer in localStorage, never as ops. The
 * whole-game analyze job owns the header — Analyze game, live progress,
 * Re-analyze — always reachable, whatever the band's state.
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
  const [expanded, setExpanded] = useState<boolean>(readExpanded);
  const [layersOpen, setLayersOpen] = useState(false);
  // Which layer the collapsed strip charts (per-viewer, persisted).
  const [spotlight, setSpotlight] = useState<string | null>(readSpotlight);

  function chooseSpotlight(id: string) {
    // Off layers switch on when picked (the popover's toggles still rule
    // on/off) — picking a dot is "show me this layer".
    if (!visible.includes(id)) {
      toggleLayer(id);
    }
    setSpotlight(id);
    localStorage.setItem(SPOTLIGHT_KEY, id);
  }

  function toggleLayer(id: string) {
    setVisible((current) => {
      const next = current.includes(id)
        ? current.filter((layer) => layer !== id)
        : [...current, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleExpanded() {
    setExpanded((current) => {
      localStorage.setItem(EXPANDED_KEY, current ? '0' : '1');
      return !current;
    });
  }

  /** A layer's empty-state note, at the height it renders at. */
  const placeholder = (copy: string, heightClass: string) => (
    <div className={`grid ${heightClass} place-items-center`}>
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

  const hasMoves = tree.mainline_ply_count > 0;
  const hasClocks = moveTimes(tree).length > 0;

  const layers: {
    id: string;
    label: string;
    dot: string;
    legend?: ReactNode;
    hasData: boolean;
    chart: (heightClass: string, compact: boolean) => ReactNode;
    /** Why the layer is empty, for its placeholders. */
    emptyCopy: string;
  }[] = [
    {
      id: 'eval',
      label: t('analysis.evalTab'),
      dot: LAYER_DOTS.eval,
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
      dot: LAYER_DOTS.material,
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
      dot: LAYER_DOTS.activity,
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
      id: 'clocks',
      label: t('analysis.clocksTab'),
      dot: LAYER_DOTS.clocks,
      legend: clocksLegend,
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
  ];

  const visibleLayers = layers.filter((layer) => visible.includes(layer.id));
  // The strip charts the spotlight layer when it's enabled (a per-viewer
  // choice — the dots switch it without opening the Layers popover), else
  // the first enabled layer that holds data.
  const spotlightLayer = visibleLayers.find((layer) => layer.id === spotlight) ?? null;
  const stripLayer = spotlightLayer ?? visibleLayers.find((layer) => layer.hasData) ?? null;

  const layerToggles = (
    <div className="flex flex-wrap items-center gap-1 p-1">
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          role="menuitemcheckbox"
          aria-checked={visible.includes(layer.id)}
          className={`inline-flex items-center gap-1 rounded-chip border px-1.5 py-0.5 font-semibold text-[10px] transition-colors ${
            visible.includes(layer.id)
              ? 'border-line-strong bg-raised text-ink'
              : 'border-line text-muted hover:text-ink'
          }`}
          data-testid="timeline-layer-toggle"
          data-layer={layer.id}
          title={layer.id === 'eval' && !hasAnalysis ? t('analysis.evalNeedsAnalysis') : undefined}
          onClick={() => toggleLayer(layer.id)}
        >
          {/* The dot is the legend: the layer's chart hue, on or off. */}
          <span className={`h-2 w-2 shrink-0 rounded-[2px] ${layer.dot}`} aria-hidden="true" />
          {layer.label}
          {layer.id === 'eval' && !hasAnalysis && (
            // The one layer that needs an analysis: a quiet gold marker
            // until the whole-game job has run.
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
              aria-hidden="true"
              data-testid="eval-layer-needs-analysis"
            />
          )}
        </button>
      ))}
    </div>
  );

  return (
    <section
      className={`${panel({ layout: 'none', pad: 'none' })} w-full`}
      data-tour="timeline-band"
      data-testid="timeline-band"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-line px-2 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            data-testid="timeline-expand"
            className={button({ intent: 'ghost', size: 'icon' })}
            aria-label={expanded ? t('analysis.collapseTimeline') : t('analysis.expandTimeline')}
            title={expanded ? t('analysis.collapseTimeline') : t('analysis.expandTimeline')}
            aria-expanded={expanded}
            onClick={toggleExpanded}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {/*
            The strip's layer picker: one dot per layer, fixed order, so
            switching the chart never moves the controls (a text label
            would jump as names change length). Hue + tooltip carry the
            layer's identity; the lit dot is the charted layer.
          */}
          {!expanded && (
            <fieldset className="m-0 flex items-center gap-1 border-none p-0">
              <legend className="sr-only">{t('analysis.stripLayer')}</legend>
              {layers.map((layer) => {
                const on = visible.includes(layer.id);
                const shown = stripLayer?.id === layer.id;
                return (
                  <input
                    key={layer.id}
                    type="radio"
                    name="timeline-spotlight"
                    aria-label={layer.label}
                    title={layer.label}
                    checked={shown}
                    data-testid="timeline-layer-dot"
                    data-layer={layer.id}
                    className={`h-2.5 w-2.5 shrink-0 cursor-pointer appearance-none rounded-[2px] transition-all ${
                      shown
                        ? `${layer.dot} ring-1 ring-ink ring-offset-1 ring-offset-panel`
                        : on
                          ? `${layer.dot} opacity-50 hover:opacity-90`
                          : 'border border-line-strong opacity-60 hover:opacity-100'
                    }`}
                    onChange={() => chooseSpotlight(layer.id)}
                  />
                );
              })}
            </fieldset>
          )}
          <div className="relative">
            <button
              type="button"
              data-testid="timeline-layers-button"
              className={button({ intent: 'ghost', size: 'xs' })}
              aria-haspopup="menu"
              aria-expanded={layersOpen}
              onClick={() => setLayersOpen((value) => !value)}
            >
              {t('analysis.layers')}
            </button>
            {layersOpen && (
              <>
                {/* Click-to-close backdrop (Esc closes via the strip's own handlers). */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLayersOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-label={t('analysis.timelineLayers')}
                  className="absolute top-full left-0 z-50 mt-1 rounded-control border border-line-strong bg-overlay shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]"
                >
                  {layerToggles}
                </div>
              </>
            )}
          </div>
        </div>
        {analyzeAction !== null && (
          <div className="flex shrink-0 items-center gap-1.5">
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
            <HelpPopover label={t('analysis.aboutAnalyzeGame')}>
              <p className="m-0 text-note text-muted">{t('analysis.helpAnalyzeGameBody')}</p>
            </HelpPopover>
          </div>
        )}
      </div>
      {expanded ? (
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
              {layer.hasData
                ? layer.chart(LAYER_HEIGHT, false)
                : placeholder(layer.emptyCopy, 'h-36')}
            </div>
          ))}
          {visibleLayers.length === 0 && (
            <div className="grid h-20 place-items-center" data-testid="timeline-band-empty">
              <p className="m-0 text-note text-faint">{t('analysis.timelineAllOff')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2" data-testid="timeline-strip">
          {stripLayer !== null ? (
            // A spotlighted layer without data explains itself (the layer's
            // own empty copy) rather than vanishing under the pick.
            stripLayer.hasData ? (
              stripLayer.chart(STRIP_HEIGHT, true)
            ) : (
              <div data-testid="timeline-strip-layer-empty">
                {placeholder(stripLayer.emptyCopy, 'h-10')}
              </div>
            )
          ) : (
            <div className="grid h-10 place-items-center" data-testid="timeline-strip-empty">
              <p className="m-0 text-note text-faint">{t('analysis.timelineStripEmpty')}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
