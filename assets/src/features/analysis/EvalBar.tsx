import { evalLabel, type WhiteEval, whiteShare } from '@/features/analysis/uci';

/**
 * Vertical win-probability-style bar: white's share from the top. The label
 * shows the evaluation from white's perspective (centipawns or mates).
 * Height is inherited from the flex row that wraps it beside the board.
 */
export default function EvalBar({ eval: white, label }: { eval: WhiteEval | null; label: string }) {
  const share = whiteShare(white);

  return (
    <div className="flex flex-col items-center gap-1" data-testid="eval-bar">
      <div
        role="img"
        aria-label={label}
        className="flex w-3 flex-1 flex-col overflow-hidden rounded-md border border-white/10"
      >
        <div className="w-full bg-[#f9f9f9]" style={{ flex: share }} data-testid="eval-white" />
        <div
          className="w-full bg-[#1a1a1a]"
          style={{ flex: 100 - share }}
          data-testid="eval-black"
        />
      </div>
      {white !== null && (
        <span className="m-0 text-xs font-medium tabular-nums text-muted" data-testid="eval-label">
          {evalLabel(white)}
        </span>
      )}
    </div>
  );
}
