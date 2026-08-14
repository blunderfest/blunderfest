import { evalLabel, type WhiteEval, whiteShare } from '@/features/analysis/uci';

/**
 * Vertical eval bar per the design spec: white's share (gradient) grows from
 * white's side of the board — from the bottom normally, from the top when
 * the board is flipped, like lichess. A tick at 50%, a gold sweep while the
 * engine thinks, and a dimmed "?" when the engine is unavailable. The value
 * badge floats inside the bar at the white/black split point. Height is
 * inherited from the flex row that wraps it beside the board.
 */
export default function EvalBar({
  eval: white,
  thinking = false,
  unavailable = false,
  flipped = false,
  label,
}: {
  eval: WhiteEval | null;
  thinking?: boolean;
  unavailable?: boolean;
  /** Board orientation: white's share anchors to white's side of the board. */
  flipped?: boolean;
  label: string;
}) {
  const share = whiteShare(white);

  return (
    <div className="flex flex-1 flex-col items-center gap-1" data-testid="eval-bar">
      <div
        role="img"
        aria-label={label}
        title={label}
        className={`relative flex w-6 flex-1 flex-col overflow-visible rounded-[5px] border border-board-edge ${
          unavailable ? 'opacity-20' : ''
        }`}
      >
        <div
          className={`absolute inset-0 flex overflow-hidden rounded-[5px] ${
            flipped ? 'flex-col' : 'flex-col-reverse'
          }`}
        >
          <div
            className={`w-full transition-[height] duration-[420ms] ease-calm ${
              flipped
                ? 'bg-gradient-to-b from-[#f4f6fb] to-[#c9cedb]'
                : 'bg-gradient-to-t from-[#f4f6fb] to-[#c9cedb]'
            }`}
            style={{ height: `${share}%` }}
            data-testid="eval-white"
          />
          <div className="w-full flex-1 bg-[#1a1d24]" data-testid="eval-black" />
          <div className="absolute top-1/2 right-0 left-0 h-px bg-line-strong" />
          {thinking && !unavailable && (
            <div className="absolute inset-x-0 h-1/3 animate-sweep bg-gradient-to-b from-transparent via-gold/25 to-transparent" />
          )}
        </div>
        {white !== null && !unavailable && (
          <span
            className={`absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-chip border border-white/20 bg-panel/95 px-1 py-0.5 text-[10px] font-semibold tabular-nums backdrop-blur-sm ${
              thinking ? 'text-faint' : 'text-ink'
            }`}
            style={{ top: `${flipped ? share : 100 - share}%` }}
            data-testid="eval-label"
          >
            {evalLabel(white)}
          </span>
        )}
        {unavailable && (
          <span className="absolute inset-0 grid place-items-center text-ui text-faint">?</span>
        )}
      </div>
    </div>
  );
}
