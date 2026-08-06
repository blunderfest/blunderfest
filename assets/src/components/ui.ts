import { tv } from 'tailwind-variants';

/**
 * Shared visual primitives, so Home, ImportForm, RoomView and Analysis don't
 * each redeclare the same tailwind-variants definitions.
 */

export const panel = tv({
  base: 'rounded-xl border border-white/10 bg-white/5',
  variants: {
    padding: { tight: 'p-4', normal: 'p-6' },
    layout: {
      stack: 'flex w-full flex-col gap-3',
      stretch: 'flex w-full flex-col items-stretch gap-3',
      none: '',
    },
    width: { sm: 'max-w-sm', md: 'max-w-xl', lg: 'max-w-2xl' },
  },
  defaultVariants: { padding: 'normal', layout: 'stack' },
});

export const button = tv({
  base: 'rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed',
  variants: {
    variant: {
      primary: 'bg-ink text-surface hover:bg-white',
      ghost: 'border border-white/10 text-ink hover:border-white/30',
    },
    size: { md: 'px-4 py-2', sm: 'px-3 py-2' },
    disabled: { dim: 'disabled:opacity-50', faint: 'disabled:opacity-40' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export const input = tv({
  base: 'w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-white/40 focus:outline-none',
});
