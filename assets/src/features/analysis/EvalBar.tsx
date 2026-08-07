import { evalLabel, type WhiteEval, whiteShare } from '@/features/analysis/uci';

/**
 * Vertical eval bar per the design spec: white's share (gradient) from the
 * top, a tick at 50%, a gold sweep while the engine thinks, and a dimmed "?"
 * when the engine is unavailable. Height is inherited from the flex row that
 * wraps it beside the board.
 */
export default function EvalBar({
  eval: white,
  thinking = false,
  unavailable = false,
  label,
}: {
  eval: WhiteEval | null;
  thinking?: boolean;
  unavailable?: boolean;
  label: string;
}) {
  const share = whiteShare(white);

  return (
    <div className="flex flex-col items-center gap-1" data-testid="eval-bar">
      <div
        role="img"
        aria-label={label}
        className={`relative flex w-6 flex-1 flex-col overflow-hidden rounded-[5px] border border-board-edge ${
          unavailable ? 'opacity-20' : ''
        }`}
      >
        <div
          className="w-full bg-gradient-to-b from-[#f4f6fb] to-[#c9cedb] transition-[height] duration-[420ms] ease-calm"
          style={{ height: `${share}%` }}
          data-testid="eval-white"
        />
        <div className="w-full flex-1 bg-[#1a1d24]" data-testid="eval-black" />
        <div className="absolute top-1/2 right-0 left-0 h-px bg-line-strong" />
        {thinking && !unavailable && (
          <div className="absolute inset-x-0 h-1/3 animate-sweep bg-gradient-to-b from-transparent via-gold/25 to-transparent" />
        )}
        {unavailable && (
          <span className="absolute inset-0 grid place-items-center text-ui text-faint">?</span>
        )}
      </div>
      {white !== null && !unavailable && (
        <span
          className={`m-0 text-note font-medium tabular-nums ${thinking ? 'text-faint' : 'text-muted'}`}
          data-testid="eval-label"
        >
          {evalLabel(white)}
        </span>
      )}
    </div>
  );
}
