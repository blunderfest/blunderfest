import { tv } from "tailwind-variants";

/* =============================================================================
   Blunderfest component specs.
   One place for every state. Screens compose these; they never invent colours.
   ============================================================================= */

export const panel = tv({
  base: "rounded-panel border border-line bg-panel shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-16px_rgba(0,0,0,0.9)]",
  variants: {
    pad: { none: "", sm: "p-2", md: "p-3", lg: "p-4" },
    flush: { true: "overflow-hidden", false: "" },
  },
  defaultVariants: { pad: "none", flush: true },
});

export const panelHeader = tv({
  base: "flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface/70 px-3",
});

export const panelTitle = tv({
  base: "text-micro font-semibold uppercase tracking-[0.11em] text-muted",
});

export const button = tv({
  base: [
    "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-control border font-semibold transition-[background,border-color,color,box-shadow] duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-hi",
    "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
  ].join(" "),
  variants: {
    intent: {
      primary:
        "border-gold/70 bg-gold text-[#20180a] hover:bg-gold-hi hover:border-gold-hi active:bg-gold active:translate-y-px",
      secondary:
        "border-line-strong bg-raised text-ink hover:bg-overlay hover:border-[#454c5b] active:translate-y-px",
      ghost:
        "border-transparent bg-transparent text-muted hover:bg-raised hover:text-ink active:translate-y-px",
      danger:
        "border-bad/50 bg-bad/12 text-bad-hi hover:bg-bad/22 hover:border-bad/70",
      quiet:
        "border-line bg-transparent text-muted hover:border-line-strong hover:text-ink",
    },
    size: {
      xs: "h-6 px-2 text-micro",
      sm: "h-8 px-3 text-note",
      md: "h-9 px-3.5 text-ui",
      lg: "h-11 px-5 text-body",
      icon: "h-8 w-8 p-0 text-ui",
      iconLg: "h-10 w-10 p-0 text-lead",
    },
    active: {
      true: "border-gold/60 bg-gold/15 text-gold-hi hover:bg-gold/20",
      false: "",
    },
    block: { true: "w-full", false: "" },
  },
  defaultVariants: { intent: "secondary", size: "md", active: false },
});

export const input = tv({
  base: [
    "w-full rounded-control border bg-surface text-ink placeholder:text-faint",
    "transition-[border-color,box-shadow] duration-150",
    "focus:border-gold/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  variants: {
    size: {
      sm: "h-8 px-2.5 text-note",
      md: "h-10 px-3 text-body",
      lg: "h-12 px-4 text-lead",
    },
    invalid: {
      true: "border-bad/70 focus:border-bad text-bad-hi",
      false: "border-line-strong hover:border-[#454c5b]",
    },
    mono: { true: "font-mono tracking-[0.28em]", false: "" },
  },
  defaultVariants: { size: "md", invalid: false, mono: false },
});

export const textarea = tv({
  base: [
    "w-full resize-none rounded-control border bg-surface p-2.5 text-body leading-[1.45] text-ink",
    "placeholder:text-faint focus:border-gold/60 focus:outline-none",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi",
  ].join(" "),
  variants: {
    invalid: { true: "border-bad/70", false: "border-line-strong" },
  },
  defaultVariants: { invalid: false },
});

export const chip = tv({
  base: "inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-micro font-semibold uppercase tracking-[0.08em]",
  variants: {
    tone: {
      neutral: "bg-raised text-muted",
      gold: "bg-gold/15 text-gold-hi",
      ok: "bg-ok/15 text-ok-hi",
      bad: "bg-bad/15 text-bad-hi",
      info: "bg-info/15 text-info",
      outline: "border border-line-strong text-muted",
    },
  },
  defaultVariants: { tone: "neutral" },
});

/* --- Board ---------------------------------------------------------------- */

export const square = tv({
  base: [
    "relative flex items-center justify-center",
    "aspect-square select-none",
    "focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-hi",
  ].join(" "),
  variants: {
    shade: { light: "bg-board-light", dark: "bg-board-dark" },
    state: {
      default: "",
      lastMove: "",
      selected: "",
      check: "",
    },
    interactive: { true: "cursor-pointer", false: "cursor-default" },
  },
  compoundVariants: [
    { shade: "light", state: "lastMove", class: "bg-move-from" },
    { shade: "dark", state: "lastMove", class: "bg-move-to" },
    {
      shade: "light",
      state: "selected",
      class: "bg-[#cfe0ff] ring-2 ring-inset ring-select",
    },
    {
      shade: "dark",
      state: "selected",
      class: "bg-[#7f93b8] ring-2 ring-inset ring-select",
    },
    {
      state: "check",
      class:
        "bg-[radial-gradient(circle,rgba(224,90,78,0.95)_10%,rgba(224,90,78,0.55)_45%,transparent_72%)]",
    },
  ],
  defaultVariants: { shade: "light", state: "default", interactive: false },
});

export const moveItem = tv({
  base: [
    "rounded-chip px-1 py-px text-left tnum transition-colors duration-100",
    "hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi",
  ].join(" "),
  variants: {
    depth: {
      main: "text-ui font-semibold text-ink",
      variation: "text-note font-normal text-muted hover:text-ink",
    },
    current: {
      true: "bg-gold/20 text-gold-hi ring-1 ring-gold/50 hover:bg-gold/25",
      false: "",
    },
    arrived: { true: "anim-arrive", false: "" },
  },
  defaultVariants: { depth: "main", current: false, arrived: false },
});

export const listRow = tv({
  base: [
    "group flex w-full items-center gap-2 px-3 py-2 text-left text-ui transition-colors duration-100",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-hi",
  ].join(" "),
  variants: {
    state: {
      default: "text-muted hover:bg-raised hover:text-ink",
      selected:
        "bg-gold/12 text-ink shadow-[inset_2px_0_0_0_var(--color-gold)] hover:bg-gold/16",
      muted: "text-faint",
    },
    arrived: { true: "anim-arrive", false: "" },
  },
  defaultVariants: { state: "default", arrived: false },
});

export const avatar = tv({
  base: "grid shrink-0 place-items-center rounded-full border text-micro font-bold uppercase",
  variants: {
    size: { sm: "h-6 w-6", md: "h-7 w-7", lg: "h-9 w-9 text-note" },
    presenting: {
      true: "border-gold ring-2 ring-gold/35",
      false: "border-line-strong",
    },
    away: { true: "opacity-45 grayscale", false: "" },
  },
  defaultVariants: { size: "md", presenting: false, away: false },
});

export const statusDot = tv({
  base: "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
  variants: {
    tone: {
      ok: "bg-ok",
      bad: "bg-bad",
      warn: "bg-gold",
      idle: "bg-faint",
    },
    pulse: { true: "anim-pulse", false: "" },
  },
  defaultVariants: { tone: "idle", pulse: false },
});

export const fieldLabel = tv({
  base: "mb-1.5 block text-micro font-semibold uppercase tracking-[0.11em] text-muted",
});

export const helpText = tv({
  base: "mt-1.5 flex items-start gap-1.5 text-note",
  variants: {
    tone: { muted: "text-faint", bad: "text-bad-hi", ok: "text-ok-hi" },
  },
  defaultVariants: { tone: "muted" },
});
