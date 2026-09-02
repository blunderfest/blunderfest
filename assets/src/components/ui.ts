import { createTV } from 'tailwind-variants';

/**
 * Shared visual primitives implementing design/DESIGN-SYSTEM.md — every
 * variant here maps to a spec section (buttons, inputs, chips, panels, list
 * rows, avatars).
 *
 * The custom type scale (text-micro/ui/body/…) must be registered as a
 * font-size group, or the merge classifies it as a *color* and silently
 * drops real text-color classes wherever both appear (e.g. the primary
 * button's light text on brand navy).
 */
export const tv = createTV({
  twMergeConfig: {
    extend: {
      classGroups: {
        'font-size': [
          'text-micro',
          'text-note',
          'text-ui',
          'text-body',
          'text-lead',
          'text-display',
          'text-hero',
        ],
      },
    },
  },
});

export const panel = tv({
  base: 'rounded-panel border border-line bg-panel shadow-panel',
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
  base: 'inline-flex items-center justify-center gap-1.5 rounded-control border font-semibold transition-[background,border-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
  variants: {
    intent: {
      primary:
        'bg-brand text-brand-ink border-brand/70 hover:bg-brand-hi hover:border-brand-hi active:translate-y-px',
      secondary:
        'bg-raised text-ink border-line-strong hover:bg-overlay hover:border-line-strong active:translate-y-px',
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
      // The 36px header's compact action: v0's `tb-btn` (h-7). Header
      // buttons must stay under the bar's height so they center, not
      // overflow — `sm` (h-8) would stick out of an h-9 row.
      tb: 'h-7 px-1.5 text-note',
    },
    active: {
      true: 'border-brand-hi/60 bg-brand/25 text-ink hover:bg-brand/30',
    },
    block: { true: 'w-full' },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
});

export const input = tv({
  base: 'w-full rounded-control border bg-surface text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-150 focus:border-accent/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
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
  base: 'w-full resize-none rounded-control border bg-surface p-2.5 text-body leading-[1.45] text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
  variants: {
    invalid: { true: 'border-bad/70' },
  },
});

export const chip = tv({
  base: 'inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-micro font-semibold uppercase tracking-[0.08em]',
  variants: {
    tone: {
      neutral: 'bg-raised text-muted',
      accent: 'bg-accent-muted text-accent',
      warn: 'bg-warn/15 text-warn-hi',
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
      warn: 'bg-warn',
      idle: 'bg-faint',
    },
    pulse: { true: 'animate-pulse-soft' },
  },
  defaultVariants: { tone: 'idle' },
});

export const listRow = tv({
  base: 'group flex w-full items-center gap-2 px-3 py-2 text-left text-ui transition-colors duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
  variants: {
    state: {
      default: 'text-muted hover:bg-raised hover:text-ink',
      selected:
        'bg-accent-muted text-ink shadow-[inset_2px_0_0_var(--color-accent)] hover:bg-accent/20',
      muted: 'text-faint',
    },
    arrived: { true: 'animate-arrive' },
  },
  defaultVariants: { state: 'default' },
});
