import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
import CriticalMoments from '@/features/analysis/CriticalMoments';
import GameReport from '@/features/analysis/GameReport';
import type { Opening } from '@/features/analysis/openings';
import SidebarTabs, { type SidebarTab } from '@/features/analysis/SidebarTabs';
import type { GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

/**
 * The visualization box: the list-like whole-game views (Moments | Report)
 * that consume the server analysis. The chart layers (Eval, Material,
 * Activity, Clocks) live in the timeline band under the board (ADR-0024,
 * as amended). Both tabs are always present; until an analysis runs they
 * show a plain note.
 */
export default function VizBox({
  tree,
  evals,
  hasAnalysis,
  opening,
  flipped,
  onSelectPly,
}: {
  tree: GameTree;
  evals: AnalysisEval[];
  hasAnalysis: boolean;
  opening: Opening | null;
  flipped: boolean;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();

  const noAnalysisNote = (
    <div className="grid h-full place-items-center">
      <p className="m-0 text-note text-faint">{t('analysis.noAnalysisYet')}</p>
    </div>
  );

  const tabs: SidebarTab[] = [
    {
      id: 'moments',
      label: t('analysis.momentsTab'),
      content: (
        // Same outer height as the report tab (p-2 + h-44): no shift on switch.
        <div className="p-2">
          <div className="h-44 overflow-y-auto">
            {hasAnalysis ? (
              <CriticalMoments
                tree={tree}
                evals={evals}
                flipped={flipped}
                onSelectPly={onSelectPly}
              />
            ) : (
              noAnalysisNote
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'report',
      label: t('analysis.reportTab'),
      content: (
        // Same outer height as the moments tab (p-2 + h-44): no shift on switch.
        <div className="p-2">
          <div className="h-44 overflow-y-auto">
            {hasAnalysis ? (
              <GameReport tree={tree} evals={evals} opening={opening} onSelectPly={onSelectPly} />
            ) : (
              noAnalysisNote
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      className={`${panel({ layout: 'none', pad: 'none' })} shrink-0 overflow-hidden`}
      data-testid="viz-box"
      data-tour="viz-box"
    >
      <SidebarTabs tabs={tabs} />
    </section>
  );
}
