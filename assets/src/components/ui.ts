import { tv } from 'tailwind-variants';

/**
 * Shared visual primitives implementing design/DESIGN-SYSTEM.md — every
 * variant here maps to a spec section (buttons, inputs, chips, panels, list
 * rows, avatars).
 */

export const panel = tv({
  base: 'rounded-panel border border-line bg-panel shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-16px_rgba(0,0,0,0.9)]',
  variants: {
    pad: { none: '', sm: 'p-2', md: 'p-3', lg: 'p-4' },
    layout: {
      stack: 'flex w-full flex-col gap-3',
      stretch: 'flex w-full flex-col items-stretch gap-3',
      none: '',
    },
  },
  defaultVariants: { pad: 'md', layout: 'stack' },
});

export const panelHeader = tv({
  base: 'flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface/70 px-3 text-micro font-semibold uppercase tracking-[0.11em] text-muted',
});

export const button = tv({
  base: 'inline-flex items-center justify-center gap-1.5 rounded-control border font-semibold transition-[background,border-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-hi disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
  variants: {
    intent: {
      primary:
        'bg-gold text-[#20180a] border-gold/70 hover:bg-gold-hi hover:border-gold-hi active:translate-y-px',
      secondary:
        'bg-raised text-ink border-line-strong hover:bg-overlay hover:border-[#454c5b] active:translate-y-px',
      ghost:
        'bg-transparent text-muted border-transparent hover:bg-raised hover:text-ink active:translate-y-px',
      danger: 'bg-bad/12 text-bad-hi border-bad/50 hover:bg-bad/22 hover:border-bad/70',
      quiet: 'bg-transparent text-muted border-line hover:border-line-strong hover:text-ink',
    },
    size: {
      xs: 'h-6 px-2 text-micro',
      sm: 'h-8 px-3 text-note',
      md: 'h-9 px-3.5 text-ui',
      lg: 'h-11 px-5 text-body',
      icon: 'h-8 w-8 text-ui',
      iconLg: 'h-10 w-10 text-lead',
    },
    active: {
      true: 'border-gold/60 bg-gold/15 text-gold-hi hover:bg-gold/20',
    },
    block: { true: 'w-full' },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
});

export const input = tv({
  base: 'w-full rounded-control border bg-surface text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-150 focus:border-gold/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    size: {
      sm: 'h-8 px-2.5 text-note',
      md: 'h-10 px-3 text-body',
      lg: 'h-12 px-4 text-lead',
    },
    invalid: { true: 'border-bad/70 text-bad-hi focus:border-bad' },
    mono: { true: 'font-mono tracking-[0.28em]' },
  },
  defaultVariants: { size: 'md' },
});

export const textarea = tv({
  base: 'w-full resize-none rounded-control border bg-surface p-2.5 text-body leading-[1.45] text-ink placeholder:text-faint focus:border-gold/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi',
  variants: {
    invalid: { true: 'border-bad/70' },
  },
});

export const chip = tv({
  base: 'inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-micro font-semibold uppercase tracking-[0.08em]',
  variants: {
    tone: {
      neutral: 'bg-raised text-muted',
      gold: 'bg-gold/15 text-gold-hi',
      ok: 'bg-ok/15 text-ok-hi',
      bad: 'bg-bad/15 text-bad-hi',
      info: 'bg-info/15 text-info',
      outline: 'border border-line-strong text-muted',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export const statusDot = tv({
  base: 'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
  variants: {
    tone: {
      ok: 'bg-ok',
      bad: 'bg-bad',
      warn: 'bg-gold',
      idle: 'bg-faint',
    },
    pulse: { true: 'animate-pulse-soft' },
  },
  defaultVariants: { tone: 'idle' },
});

export const listRow = tv({
  base: 'group flex w-full items-center gap-2 px-3 py-2 text-left text-ui transition-colors duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-hi',
  variants: {
    state: {
      default: 'text-muted hover:bg-raised hover:text-ink',
      selected: 'bg-gold/12 text-ink shadow-[inset_2px_0_0_var(--color-gold)] hover:bg-gold/16',
      muted: 'text-faint',
    },
    arrived: { true: 'animate-arrive' },
  },
  defaultVariants: { state: 'default' },
});
