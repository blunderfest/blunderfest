"use client";

import Link from "next/link";
import { useState } from "react";
import { Board } from "@/components/Board";
import { EngineReadout, EvalBar } from "@/components/Engine";
import { MoveList } from "@/components/MoveList";
import { Mark, Wordmark } from "@/components/Brand";
import {
  ActivityPanel,
  GameListPanel,
  MembersPanel,
  PanelShell,
} from "@/components/panels";
import { START_FEN } from "@/lib/chess";
import { buildTree } from "@/lib/tree";
import type { ActivityDto, GameDto, MemberDto, NodeDto } from "@/lib/types";
import {
  button,
  chip,
  fieldLabel,
  helpText,
  input,
  listRow,
  moveItem,
  panelTitle,
  square,
  statusDot,
  textarea,
} from "@/ui/variants";

/* ----------------------------- sample content ----------------------------- */

const MEMBERS: MemberDto[] = [
  { userId: "a", name: "Brave Otter 42", role: "owner", lastSeen: new Date().toISOString(), cursorNodeId: 4, online: true },
  { userId: "b", name: "Sneaky Capybara 17", role: "collaborator", lastSeen: new Date().toISOString(), cursorNodeId: 3, online: true },
  { userId: "c", name: "Patient Narwhal 61", role: "viewer", lastSeen: new Date(Date.now() - 400000).toISOString(), cursorNodeId: null, online: false },
];

const GAMES: GameDto[] = [
  { id: 1, white: "Carlsen, M", black: "Nepomniachtchi, I", event: "WCh 2021", site: null, date: "2021.12.03", result: "1-0", eco: "C88", opening: "Ruy Lopez", startFen: START_FEN, source: "lichess", plies: 136, nodeCount: 152 },
  { id: 2, white: "Brave Otter 42", black: "Sneaky Capybara 17", event: "Fresh analysis", site: null, date: "2026.02.11", result: "*", startFen: START_FEN, eco: null, opening: null, source: "blank", plies: 14, nodeCount: 21 },
];

const ACTIVITY: ActivityDto[] = [
  { id: 1, kind: "import", actorId: "a", actorName: "Brave Otter 42", detail: "imported Carlsen – Nepomniachtchi (136 plies)", createdAt: new Date().toISOString() },
  { id: 2, kind: "move", actorId: "b", actorName: "Sneaky Capybara 17", detail: "8... Na5 (variation)", createdAt: new Date().toISOString() },
  { id: 3, kind: "comment", actorId: "b", actorName: "Sneaky Capybara 17", detail: "commented on Na5", createdAt: new Date().toISOString() },
  { id: 4, kind: "present", actorId: "a", actorName: "Brave Otter 42", detail: "started presenting", createdAt: new Date().toISOString() },
];

const N = (id: number, parentId: number | null, ply: number, san: string, fen = START_FEN, comment: string | null = null): NodeDto => ({
  id, parentId, ply, san, uci: "e2e4", fen, comment, authorName: "Brave Otter 42", orderIdx: 0,
});

const SAMPLE_NODES: NodeDto[] = [
  N(1, null, 1, "e4"),
  N(2, 1, 2, "e5"),
  N(3, 2, 3, "Nf3"),
  N(4, 3, 4, "Nc6", START_FEN, "Main line. Black develops and defends e5."),
  { ...N(5, 3, 4, "d6"), orderIdx: 1 },
  N(6, 5, 5, "d4"),
  { ...N(7, 6, 6, "exd4"), orderIdx: 0 },
  { ...N(8, 6, 6, "Nf6"), orderIdx: 1 },
  N(9, 4, 5, "Bb5"),
];

/* --------------------------------- helpers -------------------------------- */

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 border-t border-line pt-8">
      <h2 className="text-display font-bold tracking-tight">{title}</h2>
      {lede && <p className="mt-1.5 max-w-[70ch] text-body text-muted">{lede}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Spec({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 font-mono text-note leading-relaxed text-faint">{children}</p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line/70 py-3 last:border-0">
      <span className="w-[136px] shrink-0 text-note text-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const SWATCHES: [string, string, string][] = [
  ["void", "#0b0d11", "page backdrop"],
  ["surface", "#14161b", "app surface / header"],
  ["panel", "#191c23", "panel fill"],
  ["raised", "#1f232c", "rows, inputs, hover"],
  ["overlay", "#232833", "dialogs"],
  ["line", "#262a33", "hairline"],
  ["line-strong", "#363c48", "divider / input border"],
  ["ink", "#e8eaf0", "primary text 14.4:1"],
  ["muted", "#9aa1b0", "secondary 6.9:1"],
  ["faint", "#737b8b", "tertiary 4.1:1"],
  ["gold", "#c9a227", "accent / owner"],
  ["gold-hi", "#e8c14f", "accent text 7.6:1"],
  ["ok", "#4caf50", "positive"],
  ["bad", "#e05a4e", "negative / errors"],
  ["info", "#6ea8fe", "presence, remote edits"],
  ["board-light", "#f0d9b5", "light square"],
  ["board-dark", "#b58863", "dark square"],
];

const TYPE_SCALE: [string, string, string, string][] = [
  ["hero", "text-hero", "36/40 · 700", "home wordmark only"],
  ["display", "text-display", "24/30 · 700", "screen titles"],
  ["lead", "text-lead", "16/24 · 600", "panel headings, eval readout"],
  ["body", "text-body", "14/22 · 400", "comments, prose, inputs"],
  ["ui", "text-ui", "13/20 · 400–600", "dense UI default, move list"],
  ["note", "text-note", "12/18 · 400", "metadata, activity feed"],
  ["micro", "text-micro", "11/16 · 600 caps", "panel titles, chips, role labels"],
];

export default function DesignPage() {
  const [invalidDemo, setInvalidDemo] = useState(true);
  const tree = buildTree(SAMPLE_NODES);

  return (
    <div className="min-h-screen bg-void">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
        <Wordmark size="sm" />
        <span className={chip({ tone: "gold" })}>design system</span>
        <nav className="ml-auto hidden gap-1 md:flex">
          {[
            ["direction", "Direction"],
            ["board", "Board"],
            ["eval", "Eval"],
            ["moves", "Moves"],
            ["rows", "Rows"],
            ["forms", "Forms"],
            ["motion", "Motion"],
            ["layout", "Layout"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className={button({ intent: "ghost", size: "sm" })}>
              {label}
            </a>
          ))}
        </nav>
        <Link href="/" className={button({ intent: "secondary", size: "sm" })}>
          Home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1100px] space-y-10 px-5 py-8">
        <div>
          <h1 className="text-display font-bold tracking-tight">
            Blunderfest UI kit
          </h1>
          <p className="mt-2 max-w-[74ch] text-body text-muted">
            Dark-first, dense, calm. The board is the hero: it is the only
            element allowed high-chroma, high-value colour. Everything else is
            neutral panels, one gold accent for &ldquo;this is active / this is
            yours&rdquo;, blue for &ldquo;someone else is here&rdquo;, and
            red/green reserved for evaluation and errors.
          </p>
        </div>

        {/* ------------------------------ direction ---------------------- */}
        <Section
          id="direction"
          title="Visual direction"
          lede="Tokens are declared once in globals.css via Tailwind v4 @theme, so every class below is a real utility (bg-panel, text-muted, rounded-panel …)."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className={panelTitle()}>Palette</h3>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SWATCHES.map(([name, hex, use]) => (
                  <li key={name} className="rounded-control border border-line bg-panel p-2">
                    <span
                      className="block h-8 rounded-[4px] border border-line-strong"
                      style={{ background: hex }}
                    />
                    <span className="mt-1.5 block text-note font-semibold text-ink">{name}</span>
                    <span className="block font-mono text-micro text-faint">{hex}</span>
                    <span className="block text-micro text-faint">{use}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className={panelTitle()}>Type scale — Open Sans</h3>
                <ul className="mt-3 divide-y divide-line rounded-panel border border-line bg-panel px-3">
                  {TYPE_SCALE.map(([name, cls, size, use]) => (
                    <li key={name} className="flex items-baseline gap-3 py-2">
                      <span className={`${cls} font-semibold text-ink`}>Nf3!?</span>
                      <span className="text-note text-muted">{name}</span>
                      <span className="ml-auto font-mono text-micro text-faint">{size}</span>
                      <span className="hidden w-[180px] text-right text-micro text-faint sm:block">
                        {use}
                      </span>
                    </li>
                  ))}
                </ul>
                <Spec>
                  Notation always uses <b>tnum</b> (tabular figures) so move
                  numbers and evals never jitter while updating.
                </Spec>
              </div>

              <div>
                <h3 className={panelTitle()}>Spacing, radius, elevation</h3>
                <div className="mt-3 space-y-2 rounded-panel border border-line bg-panel p-3">
                  <Spec>
                    space: 4 · 6 · 8 · 12 · 16 · 24 (gap-1 … gap-6). Panel gutter
                    12px, room grid gap 12px, panel padding 10–12px, dialog 16px.
                  </Spec>
                  <div className="flex flex-wrap items-end gap-3">
                    {[
                      ["chip", "rounded-chip", "4px"],
                      ["control", "rounded-control", "6px"],
                      ["panel", "rounded-panel", "10px"],
                      ["dialog", "rounded-dialog", "14px"],
                    ].map(([name, cls, px]) => (
                      <span key={name} className="text-center">
                        <span className={`block h-12 w-16 border border-line-strong bg-raised ${cls}`} />
                        <span className="mt-1 block text-micro text-faint">
                          {name} · {px}
                        </span>
                      </span>
                    ))}
                  </div>
                  <Spec>
                    Elevation is border + fill, never shadow-only: panel =
                    1px&nbsp;line + bg-panel + a 1px inset top highlight; dialogs
                    add a long, soft drop shadow and bg-overlay. No coloured
                    glows anywhere near the board.
                  </Spec>
                </div>
              </div>

              <div>
                <h3 className={panelTitle()}>Logo</h3>
                <div className="mt-3 flex flex-wrap items-center gap-6 rounded-panel border border-line bg-panel p-4">
                  <Mark size="lg" />
                  <Wordmark size="md" href={null} />
                  <Wordmark size="sm" href={null} />
                </div>
                <Spec>
                  Gold knight tile with a small red &ldquo;?!&rdquo; badge — the
                  mascot is a knight caught mid-blunder. Tile alone is the
                  favicon/app icon; the badge is dropped below 20px.
                </Spec>
              </div>
            </div>
          </div>
        </Section>

        {/* -------------------------------- board ------------------------- */}
        <Section
          id="board"
          title="Board squares"
          lede="Squares are buttons in a role=grid. Roving tabindex, arrow keys move the cursor, Enter selects then plays, Escape clears. Every square has an aria-label; legal targets append the SAN."
        >
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div>
              <div className="grid grid-board overflow-hidden rounded-[6px] border border-board-edge">
                {[
                  { shade: "light", state: "default", glyph: "" },
                  { shade: "dark", state: "default", glyph: "" },
                  { shade: "light", state: "lastMove", glyph: "" },
                  { shade: "dark", state: "lastMove", glyph: "♞" },
                  { shade: "light", state: "selected", glyph: "♗" },
                  { shade: "dark", state: "selected", glyph: "♜" },
                  { shade: "light", state: "check", glyph: "♔" },
                  { shade: "dark", state: "default", glyph: "♟" },
                ].map((cell, i) => (
                  <span
                    key={i}
                    className={square({
                      shade: cell.shade as "light" | "dark",
                      state: cell.state as "default" | "lastMove" | "selected" | "check",
                    })}
                  >
                    <span className="text-[26px] leading-none text-[#2a2418]">{cell.glyph}</span>
                  </span>
                ))}
                {/* legal targets */}
                {[0, 1].map((i) => (
                  <span
                    key={`t${i}`}
                    className={square({ shade: i ? "dark" : "light", interactive: true })}
                  >
                    <span className="absolute h-[28%] w-[28%] rounded-full bg-[rgba(20,22,27,0.3)]" />
                  </span>
                ))}
                {[0, 1].map((i) => (
                  <span
                    key={`c${i}`}
                    className={square({ shade: i ? "light" : "dark", interactive: true })}
                  >
                    <span className="absolute inset-[6%] rounded-full border-[5px] border-[rgba(20,22,27,0.35)]" />
                    <span className="text-[26px] leading-none text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.45)]">
                      ♛
                    </span>
                  </span>
                ))}
                {[0, 1].map((i) => (
                  <span key={`h${i}`} className={square({ shade: i ? "dark" : "light" })}>
                    <svg viewBox="0 0 1 1" className="absolute inset-0 h-full w-full">
                      <line x1="0.5" y1="0.9" x2="0.5" y2="0.15" stroke="var(--color-gold)" strokeWidth="0.14" strokeLinecap="round" opacity="0.85" />
                      <path d="M0.34,0.28 L0.5,0.06 L0.66,0.28 z" fill="var(--color-gold)" opacity="0.85" />
                    </svg>
                  </span>
                ))}
              </div>
              <Spec>
                row 1 default · row 2 last-move (#cdd26a / #aaa23a) · row 3
                selected (+2px inset ring, --color-select) · row 4 check
                (radial red) · row 5 legal target: dot 28% for quiet, 5px ring
                for captures · row 6 hint arrow overlay (SVG, 0.16 stroke).
              </Spec>
            </div>

            <div>
              <div className="mx-auto max-w-[420px]">
                <Board fen={START_FEN} orientation="white" />
              </div>
              <Spec>
                Live component. Focus ring is the gold outline drawn inside the
                square; the board never loses its focus indicator on dark or
                light squares.
              </Spec>
            </div>
          </div>
        </Section>

        {/* --------------------------------- eval -------------------------- */}
        <Section
          id="eval"
          title="Eval bar & engine readout"
          lede="White's share is drawn from the top; the value sits inside the bar on the leading side. Values animate over 420ms with the calm easing — never a spring, never a bounce."
        >
          <div className="flex flex-wrap items-stretch gap-6">
            {[
              { label: "+0.32", evaluation: { cp: 32, mate: null, depth: 14, pv: [], bestMove: null, gameOver: null }, status: "ready" as const },
              { label: "−1.80", evaluation: { cp: -180, mate: null, depth: 16, pv: [], bestMove: null, gameOver: null }, status: "ready" as const },
              { label: "M3", evaluation: { cp: null, mate: 3, depth: 18, pv: [], bestMove: null, gameOver: null }, status: "ready" as const },
              { label: "thinking", evaluation: { cp: 12, mate: null, depth: 6, pv: [], bestMove: null, gameOver: null }, status: "thinking" as const },
              { label: "unavailable", evaluation: null, status: "unavailable" as const },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div className="h-[220px]">
                  <EvalBar evaluation={item.evaluation} status={item.status} />
                </div>
                <span className="text-micro text-faint">{item.label}</span>
              </div>
            ))}

            <div className="min-w-[300px] flex-1 space-y-2">
              <EngineReadout
                evaluation={{ cp: 32, mate: null, depth: 14, pv: ["Nf3", "Nc6", "Bb5"], bestMove: "Nf3", gameOver: null }}
                status="ready"
                turn="w"
                fullmove={3}
              />
              <EngineReadout
                evaluation={{ cp: 5, mate: null, depth: 4, pv: [], bestMove: null, gameOver: null }}
                status="thinking"
                turn="w"
                fullmove={3}
              />
              <EngineReadout evaluation={null} status="unavailable" turn="w" fullmove={1} onRetry={() => undefined} />
              <Spec>
                24px wide (w-7 incl. border), full board height, 5px radius.
                Thinking = a slow gold sweep over the bar + pulsing status dot;
                the last known value stays on screen (never blank, never zeroed).
                Unavailable = 18% opacity track, &ldquo;?&rdquo; glyph, and an
                inline explanation with a Retry action.
              </Spec>
            </div>
          </div>
        </Section>

        {/* -------------------------------- moves -------------------------- */}
        <Section
          id="moves"
          title="Move list"
          lede="Main line is 13px semibold ink; variations drop to 12px muted, wrapped in parens and indented with a left hairline. Move numbers appear for every White move and for Black only at the start of a line, after a comment, or after a variation (2…)."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
            <PanelShell title="Moves" className="h-[260px]" bodyClassName="min-h-0">
              <MoveList
                tree={tree}
                currentId={4}
                recentIds={[9]}
                cursors={{ 3: [{ name: "Sneaky Capybara 17", hue: 200 }] }}
                onSelect={() => undefined}
              />
            </PanelShell>
            <div>
              <div className="flex flex-wrap gap-2 rounded-panel border border-line bg-panel p-3">
                <span className={moveItem({ depth: "main" })}>Nf3</span>
                <span className={moveItem({ depth: "main", current: true })}>Nc6</span>
                <span className={moveItem({ depth: "variation" })}>d6</span>
                <span className={moveItem({ depth: "main", arrived: true })}>Bb5</span>
              </div>
              <Spec>
                default · current (gold 20% fill + 1px gold ring, the only gold
                fill in the sidebar) · variation · just-arrived (1.2s info-blue
                flash, see Motion). Hover = bg-raised. Focus = gold outline.
                Comment markers are a 9px blue dot after the SAN; main-line
                comments break onto their own indented block.
              </Spec>
            </div>
          </div>
        </Section>

        {/* --------------------------------- rows -------------------------- */}
        <Section
          id="rows"
          title="List rows: games, members, activity"
          lede="One row primitive, three uses. 36–44px tall, 12px horizontal padding, selected state marked by a 2px gold inset bar plus a 12% gold wash — never by colour alone."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <GameListPanel games={GAMES} activeId={1} canEdit onSelect={() => undefined} onImport={() => undefined} />
            <MembersPanel
              members={MEMBERS}
              ownerId="a"
              presenterId="a"
              youId="b"
              canManage
              onRole={() => undefined}
            />
            <ActivityPanel activity={ACTIVITY} youId="b" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-panel border border-line bg-panel">
              <div className={listRow({ state: "default" })}>default row</div>
              <div className={listRow({ state: "selected" })}>selected row</div>
              <div className={listRow({ state: "muted" })}>muted / offline row</div>
              <div className={listRow({ state: "default", arrived: true })}>just arrived</div>
            </div>
            <div className="rounded-panel border border-line bg-panel p-3">
              <Spec>
                Role icons: ♔ gold = owner, ♘ silver = collaborator, ♙ faint =
                pawn/viewer. Each carries a title + aria-label, so role is never
                icon-only for assistive tech. Promote / Demote buttons live at
                the row end, revealed on hover <b>and</b> on focus-within
                (keyboard users get them too), and only render for the owner.
                Presenting members get a gold ring on the avatar plus a
                &ldquo;presenting&rdquo; chip.
              </Spec>
            </div>
          </div>
        </Section>

        {/* -------------------------------- forms -------------------------- */}
        <Section
          id="forms"
          title="Buttons, inputs, import form"
          lede="Four intents, five sizes. Gold primary is used at most once per surface — creating a room, importing a game, saving a comment."
        >
          <div className="rounded-panel border border-line bg-panel px-4 py-1">
            <Row label="primary">
              <button className={button({ intent: "primary", size: "sm" })}>Small</button>
              <button className={button({ intent: "primary" })}>Create a room</button>
              <button className={button({ intent: "primary", size: "lg" })}>Large</button>
              <button className={button({ intent: "primary" })} disabled>Disabled</button>
            </Row>
            <Row label="secondary / ghost">
              <button className={button({ intent: "secondary" })}>Cancel</button>
              <button className={button({ intent: "ghost" })}>Ghost</button>
              <button className={button({ intent: "ghost", active: true })}>Ghost active</button>
              <button className={button({ intent: "quiet", size: "xs" })}>Promote</button>
              <button className={button({ intent: "danger", size: "sm" })}>Remove</button>
            </Row>
            <Row label="icon">
              <button className={button({ intent: "ghost", size: "icon" })} aria-label="Previous">◀</button>
              <button className={button({ intent: "ghost", size: "icon" })} aria-label="Next">▶</button>
              <button className={button({ intent: "secondary", size: "iconLg" })} aria-label="Flip">⇅</button>
            </Row>
            <Row label="status">
              <span className={chip({ tone: "gold" })}>presenting</span>
              <span className={chip({ tone: "info" })}>lichess</span>
              <span className={chip({ tone: "ok" })}>saved</span>
              <span className={chip({ tone: "bad" })}>blunder</span>
              <span className={chip({ tone: "outline" })}>1-0</span>
              <span className="flex items-center gap-1.5 text-note text-muted">
                <span className={statusDot({ tone: "ok" })} /> live
              </span>
              <span className="flex items-center gap-1.5 text-note text-muted">
                <span className={statusDot({ tone: "warn", pulse: true })} /> reconnecting
              </span>
            </Row>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-panel border border-line bg-panel p-4">
              <label className={fieldLabel()} htmlFor="demo-code">Room code (valid)</label>
              <input id="demo-code" defaultValue="qh4nx" className={input({ size: "lg", mono: true })} />
              <p className={helpText()}><span className="tnum">5/5 characters</span></p>

              <label className={fieldLabel() + " mt-4"} htmlFor="demo-code-bad">Room code (error)</label>
              <input
                id="demo-code-bad"
                defaultValue="l0ops"
                aria-invalid={invalidDemo}
                onChange={() => setInvalidDemo(false)}
                className={input({ size: "lg", mono: true, invalid: invalidDemo })}
              />
              <p className={helpText({ tone: invalidDemo ? "bad" : "muted" })}>
                <span aria-hidden>⚠</span>
                <span>{invalidDemo ? "No i, l, o, 0 or 1 — those characters are not in the alphabet." : "Looks fine now."}</span>
              </p>

              <label className={fieldLabel() + " mt-4"} htmlFor="demo-disabled">Disabled</label>
              <input id="demo-disabled" disabled placeholder="Owner only" className={input()} />
            </div>

            <div className="rounded-panel border border-line bg-panel p-4">
              <label className={fieldLabel()} htmlFor="demo-pgn">PGN or Lichess URL</label>
              <textarea id="demo-pgn" rows={4} className={textarea() + " font-mono text-note"} defaultValue={"1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"} />
              <p className={helpText({ tone: "ok" })}>
                <span aria-hidden>✓</span>
                <span>Parsed: 6 ply · 6 nodes · Ruy Lopez</span>
              </p>
              <label className={fieldLabel() + " mt-4"} htmlFor="demo-pgn-bad">PGN (error)</label>
              <textarea id="demo-pgn-bad" rows={2} aria-invalid className={textarea({ invalid: true }) + " font-mono text-note"} defaultValue={"1. e4 e9 2. Qxz7#"} />
              <p className={helpText({ tone: "bad" })}>
                <span aria-hidden>⚠</span>
                <span>Illegal or unreadable move &ldquo;e9&rdquo; — nothing was imported.</span>
              </p>
            </div>
          </div>
        </Section>

        {/* -------------------------------- motion ------------------------- */}
        <Section
          id="motion"
          title="Micro-interactions"
          lede="Liveness should be legible, not loud. Nothing moves the board; everything else acknowledges quietly."
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["A move arrives from someone else", "The new SAN token flashes info-blue at 40% and fades over 1.2s (anim-arrive). If you are on the parent node and following, the board advances; otherwise nothing under your hands moves — the token just appears with a presence dot showing whose cursor sits there."],
              ["Presence joins / leaves", "Avatar pops in at 0.86→1 scale over 160ms, activity feed prepends a row with the same 1.2s flash. Leaving fades the avatar to 45% + grayscale rather than removing it for 45s, so the list does not jump."],
              ["Eval bar updates", "Height transitions 420ms cubic-bezier(.22,.61,.36,1). The number cross-fades only when the rounded value changes; depth counts up in place with tabular figures."],
              ["Engine thinking", "Gold sweep travels the bar every 1.6s, status dot pulses, readout label switches Depth→Thinking. Last value remains visible and dimmed to 85% so the bar never flickers to 0.00."],
              ["Engine unavailable", "After two failed inits the bar goes flat 18% with a ‘?’; readout becomes an explanatory line with Retry. All collaboration keeps working."],
              ["Comment saved", "Button label → ‘Saved for everyone’ under the field; the move's blue comment dot scales in. ⌘↵ saves without leaving the keyboard."],
              ["Copy room code", "Icon swaps to a green ✓ for 1.6s, live region announces ‘Room link for qh4nx copied’."],
              ["Reconnecting", "Header dot turns gold and pulses; the room stays interactive and queues your moves. No modal, no blocking spinner."],
              ["Reduced motion", "prefers-reduced-motion collapses every animation to ~0ms; arrivals then rely on the persistent presence dot and feed row, not the flash."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-panel border border-line bg-panel p-3">
                <h3 className="text-ui font-bold text-ink">{title}</h3>
                <p className="mt-1 text-note leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* -------------------------------- layout ------------------------- */}
        <Section
          id="layout"
          title="Layout & extensibility"
          lede="Room = 236px rail · fluid board (min 560px) · 340px sidebar, 12px gaps, page never scrolls above 1280px. Below that it stacks: board first, then sidebar panels, then the rail."
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="rounded-panel border border-line bg-panel p-3">
              <div className="grid h-[260px] grid-cols-[110px_1fr_150px] gap-2 text-micro">
                <div className="flex flex-col gap-2">
                  <Slot label="Games" />
                  <Slot label="Members" />
                  <Slot label="Activity" grow />
                  <Slot label="Chat / polls" ghost />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-1 gap-2">
                    <div className="w-4 rounded-[4px] border border-line-strong bg-raised" />
                    <div className="grid flex-1 place-items-center rounded-[4px] border border-gold/40 bg-gold/5 text-gold-hi">
                      board
                    </div>
                  </div>
                  <Slot label="Engine readout" />
                  <Slot label="Controls" />
                  <Slot label="Eval curve / report" ghost />
                </div>
                <div className="flex flex-col gap-2">
                  <Slot label="Comment" />
                  <Slot label="Moves" grow />
                  <Slot label="Engine lines" ghost />
                  <Slot label="Opening / masters" ghost />
                  <Slot label="Game info" />
                </div>
              </div>
              <Spec>
                Dashed slots are reserved, not built. Engine lines dock directly
                under Moves (insertable as variations); the opening/ECO +
                master-reference panel shares that stack and collapses to a
                single 28px header when empty. Whole-game report and the eval
                curve live under the board, where the readout already
                establishes a horizontal band. Chat and move polls take the
                bottom of the left rail, below Activity, since they share its
                &ldquo;stream&rdquo; behaviour.
              </Spec>
            </div>

            <div>
              <h3 className={panelTitle()}>Mobile stack (&lt;1280px)</h3>
              <div className="mx-auto mt-3 w-[240px] rounded-dialog border border-line-strong bg-surface p-2">
                <div className="mb-2 flex h-6 items-center gap-1.5 rounded-[4px] bg-panel px-1.5 text-micro text-faint">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-gold" /> Blunderfest
                  <span className="ml-auto font-mono text-gold-hi">qh4nx</span>
                </div>
                <div className="space-y-1.5 text-micro">
                  <div className="flex gap-1.5">
                    <div className="w-3 rounded-[3px] bg-raised" />
                    <div className="grid aspect-square flex-1 place-items-center rounded-[3px] border border-gold/40 bg-gold/5 text-gold-hi">
                      board
                    </div>
                  </div>
                  <Slot label="Engine + controls" small />
                  <Slot label="Comment" small />
                  <Slot label="Moves (max-h 40vh)" small />
                  <Slot label="Games · Members · Activity" small />
                </div>
              </div>
              <Spec>
                Order: board → engine/controls → comment → moves → rail panels.
                The page scrolls normally here; only the move list keeps its own
                max-height so the thumb can still reach the board. Header keeps
                brand + code + name; Library moves into an overflow menu.
              </Spec>
            </div>
          </div>
        </Section>

        <Section id="a11y" title="Accessibility contract">
          <ul className="grid gap-2 text-body text-muted md:grid-cols-2">
            {[
              "Every interactive element shows a 2px gold-hi outline at 2px offset — including squares, move tokens and rows.",
              "Board: role=grid, roving tabindex, arrow/Home/End movement, Enter to select and play, Escape to clear, per-square aria-labels naming piece, colour and square.",
              "Room shortcuts: ← → move through the line, Home/End jump to start/end, F flips — all suppressed while typing in a field.",
              "aria-live=polite regions: engine readout, activity feed, board announcements ('Nf3 played', 'knight on g1 selected, 3 legal moves').",
              "Contrast: ink 14.4:1, muted 6.9:1, gold-hi 7.6:1 on surface; faint is limited to non-essential metadata at ≥11px semibold.",
              "State is never colour-only: selected rows add a gold inset bar, roles add text labels via title/aria-label, errors add an ⚠ glyph and text.",
              "Dialogs trap nothing the user cannot escape: Esc closes, backdrop click closes, focus lands in the textarea, and the trigger is restored.",
              "prefers-reduced-motion disables the arrival flash, sweep and pulses.",
            ].map((item) => (
              <li key={item} className="flex gap-2 rounded-control border border-line bg-panel p-3">
                <span aria-hidden className="text-ok-hi">✓</span>
                <span className="text-note leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}

function Slot({
  label,
  grow,
  ghost,
  small,
}: {
  label: string;
  grow?: boolean;
  ghost?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={[
        "grid place-items-center rounded-[4px] px-1 text-center",
        small ? "h-7" : "h-8",
        grow ? "flex-1" : "",
        ghost
          ? "border border-dashed border-line-strong text-faint"
          : "border border-line bg-raised text-muted",
      ].join(" ")}
    >
      {label}
    </div>
  );
}
