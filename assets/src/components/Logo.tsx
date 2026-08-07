import { tv } from 'tailwind-variants';

const tile = tv({
  base: 'relative grid shrink-0 place-items-center rounded-control bg-gold text-[#20180a] select-none',
  variants: {
    size: {
      sm: 'h-6 w-6 text-sm',
      md: 'h-8 w-8 text-lg',
      lg: 'h-12 w-12 text-2xl',
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
      lg: 'text-hero',
    },
  },
  defaultVariants: { size: 'sm' },
});

/**
 * The Blunderfest mark: a gold knight tile with a red "?!" badge (dropped at
 * small sizes) plus the two-tone wordmark.
 */
export default function Logo({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={tile({ size })} aria-hidden="true">
        ♞
        {size !== 'sm' && (
          <span className="absolute -top-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-bad text-[8px] font-bold text-white">
            ?
          </span>
        )}
      </span>
      <span className={wordmark({ size })}>
        <span className="text-ink">Blunder</span>
        <span className="text-gold-hi">fest</span>
      </span>
    </span>
  );
}
