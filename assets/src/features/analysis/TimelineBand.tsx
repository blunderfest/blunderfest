import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
import ActivityFlow from '@/features/analysis/ActivityFlow';
import ClocksFlow from '@/features/analysis/ClocksFlow';
import GameFlow from '@/features/analysis/GameFlow';
import MaterialFlow, { type CapturePoint } from '@/features/analysis/MaterialFlow';
import type { GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const STORAGE_KEY = 'blunderfest.timelineLayers';
/** Eval carries the quality strip and analyze action; material pairs with it. */
const DEFAULT_LAYERS = ['eval', 'material'];
/** The timeline band's layer height: compact — the layers stack (ADR-0024). */
const LAYER_HEIGHT = 'h-36';

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
 * charts — eval, material, activity — stacked as layers on one shared
 * move axis (visualization ideas §16), full width under the board.
 * Every layer uses the same span and the same scrub-to-ply gesture, so
 * the gold current-position marker walks the layers together. Toggles
 * persist in localStorage; new whole-game timelines join as layers
 * here, never as sidebar tabs.
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
  analyzePlaceholder,
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
  /** What the eval layer shows before any analysis ran (the analyze action). */
  analyzePlaceholder: ReactNode;
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

  const layers = [
    {
      id: 'eval',
      label: t('analysis.evalTab'),
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
        analyzePlaceholder
      ),
    },
    {
      id: 'material',
      label: t('analysis.materialTab'),
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
      <fieldset className="m-0 min-w-0 border-0 border-b border-line px-2 py-1">
        <legend className="sr-only">{t('analysis.timelineLayers')}</legend>
        <div className="flex flex-wrap items-center gap-1">
          {layers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={`rounded-chip border px-1.5 py-0.5 font-semibold text-[10px] transition-colors ${
                visible.includes(layer.id)
                  ? 'border-line-strong bg-raised text-ink'
                  : 'border-line text-muted hover:text-ink'
              }`}
              aria-pressed={visible.includes(layer.id)}
              data-testid="timeline-layer-toggle"
              data-layer={layer.id}
              onClick={() => toggleLayer(layer.id)}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2 p-2">
        {visibleLayers.map((layer) => (
          <div key={layer.id} data-testid={`timeline-layer-${layer.id}`}>
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
