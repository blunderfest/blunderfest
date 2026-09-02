import { tv } from 'tailwind-variants';

const mark = tv({
  base: 'relative inline-grid shrink-0 select-none place-items-center',
  variants: {
    size: {
      sm: 'h-6 w-6',
      md: 'h-8 w-8',
    },
  },
  defaultVariants: { size: 'sm' },
});

const wordmark = tv({
  base: 'font-bold tracking-[-0.01em]',
  variants: {
    size: {
      sm: 'text-ui',
      md: 'text-lead',
    },
  },
  defaultVariants: { size: 'sm' },
});

// Separately optimized native-size micro marks (Phase 2C): each rendered size
// gets the asset designed for it, never a scaled 48px file. Both theme
// variants render; <html data-theme> (set pre-paint in index.html) picks the
// visible one via CSS, so the first paint shows the correct asset with no
// flash and no CSS filters.
const ASSETS = {
  sm: {
    light: '/brand/openchesslab-micro-light-24.svg',
    dark: '/brand/openchesslab-micro-dark-24.svg',
  },
  md: {
    light: '/brand/openchesslab-micro-light-32.svg',
    dark: '/brand/openchesslab-micro-dark-32.svg',
  },
} as const;

export default function Logo({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const assets = ASSETS[size];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={mark({ size })} aria-hidden="true">
        <img
          src={assets.light}
          alt=""
          className="col-start-1 row-start-1 h-full w-full [[data-theme=dark]_&]:hidden"
        />
        <img
          src={assets.dark}
          alt=""
          className="col-start-1 row-start-1 hidden h-full w-full [[data-theme=dark]_&]:block"
        />
      </span>
      <span className={`${wordmark({ size })} text-ink`}>OpenChessLab</span>
    </span>
  );
}
