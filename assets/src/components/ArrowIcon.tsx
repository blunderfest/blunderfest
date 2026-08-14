const PATHS = {
  left: 'M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18',
  right: 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
  up: 'M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18',
  down: 'M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3',
} as const;

/**
 * Keyboard-hint arrows as SVG — neither Open Sans nor JetBrains Mono has
 * ←/→ glyphs, so text arrows would fall back to a system font.
 */
export default function ArrowIcon({
  of,
  className,
}: {
  of: keyof typeof PATHS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[of]} />
    </svg>
  );
}
