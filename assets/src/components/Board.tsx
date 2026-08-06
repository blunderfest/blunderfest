import { tv } from 'tailwind-variants';
import {
  isLightSquare,
  type Piece,
  type Position,
  pieceGlyph,
  squareName,
} from '@/components/board';

const square = tv({
  base: 'relative flex items-center justify-center',
  variants: {
    shade: { light: 'bg-[#f0d9b5]', dark: 'bg-[#b58863]' },
  },
});

const coord = tv({
  base: 'absolute text-[10px] font-semibold',
  variants: {
    shade: { light: 'text-[#b58863]', dark: 'text-[#f0d9b5]' },
  },
});

export default function Board({
  position,
  lastMove,
  flipped = false,
  label = 'Chess board',
  interactive = false,
  selected = null,
  legalTargets = [],
  onSquareClick,
}: {
  position: Position;
  lastMove?: { from: string; to: string } | null;
  flipped?: boolean;
  label?: string;
  interactive?: boolean;
  selected?: string | null;
  legalTargets?: string[];
  onSquareClick?: (square: string) => void;
}) {
  const indices = flipped ? [...Array(64).keys()].reverse() : [...Array(64).keys()];
  const rankRow = flipped ? 1 : 8;
  const fileCol = flipped ? 7 : 0;

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is img or group, both support aria-label
    <div
      className="grid aspect-square w-[min(90vw,34rem)] grid-cols-8 grid-rows-8 select-none overflow-hidden rounded-lg border border-white/10 shadow-lg"
      role={interactive ? 'group' : 'img'}
      aria-label={label}
    >
      {indices.map((index) => {
        const name = squareName(index);
        const piece = position[index];
        const file = index % 8;
        const rank = 8 - Math.floor(index / 8);
        const shade = isLightSquare(index) ? 'light' : 'dark';
        const isLastMove = lastMove !== null && (lastMove?.from === name || lastMove?.to === name);
        const isSelected = selected === name;
        const isTarget = legalTargets.includes(name);
        const clickable = interactive && onSquareClick !== undefined;

        const content = (
          <>
            {file === fileCol && (
              <span className={`${coord({ shade })} top-0.5 left-1`}>{rank}</span>
            )}
            {rank === rankRow && (
              <span className={`${coord({ shade })} right-1 bottom-0.5`}>{name[0]}</span>
            )}
            {piece && <PieceGlyph piece={piece} />}
            {isLastMove && <div className="absolute inset-0 bg-yellow-400/40" />}
            {isSelected && (
              <div data-testid={`selected-${name}`} className="absolute inset-0 bg-yellow-300/50" />
            )}
            {isTarget &&
              (piece ? (
                <div
                  data-testid={`target-${name}`}
                  className="absolute inset-0 rounded-full border-4 border-emerald-400/70"
                />
              ) : (
                <div
                  data-testid={`target-${name}`}
                  className="absolute h-1/3 w-1/3 rounded-full bg-emerald-400/70"
                />
              ))}
          </>
        );

        if (clickable) {
          return (
            <button
              key={index}
              type="button"
              data-testid={`square-${name}`}
              aria-label={name}
              className={`${square({ shade })} cursor-pointer`}
              onClick={() => onSquareClick(name)}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={index} data-testid={`square-${name}`} className={square({ shade })}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function PieceGlyph({ piece }: { piece: Piece }) {
  return (
    <span
      className="text-[min(10vw,3.75rem)] leading-none"
      style={{
        color: piece.color === 'w' ? '#f9f9f9' : '#1a1a1a',
        textShadow:
          piece.color === 'w' ? '0 1px 3px rgba(0,0,0,0.55)' : '0 1px 1px rgba(255,255,255,0.35)',
      }}
    >
      {pieceGlyph(piece.color, piece.kind)}
    </span>
  );
}
