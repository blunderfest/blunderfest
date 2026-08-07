"use client";

import { useEffect, useRef, useState } from "react";
import { button, chip, fieldLabel, helpText, panelTitle, textarea } from "@/ui/variants";

interface Summary {
  white: string;
  black: string;
  whiteElo: string | null;
  blackElo: string | null;
  event: string;
  date: string | null;
  result: string;
  eco: string | null;
  opening: string | null;
  plies: number;
  nodes: number;
}

const SAMPLE = `[Event "Casual Rapid"]
[Site "lichess.org"]
[Date "2026.02.11"]
[White "Brave Otter 42"]
[Black "Sneaky Capybara 17"]
[Result "1-0"]
[ECO "C50"]
[Opening "Italian Game"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 (5... Bb6 6. dxe5 Nxe4
{sharper, and probably better}) 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5
Nxd5 10. Qb3 Nce7 11. O-O O-O 12. Rfe1 c6 13. a4 Qb6 14. Qxb6 axb6 1-0`;

export function ImportDialog({
  open,
  onClose,
  onImport,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (pgn: string, source: string) => Promise<void> | void;
  busy?: boolean;
}) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pgn, setPgn] = useState("");
  const [source, setSource] = useState("pgn");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => areaRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function preview(value = input) {
    setState("loading");
    setError(null);
    setWarnings([]);
    setSummary(null);
    const response = await fetch("/api/import/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: value }),
    });
    const data = await response.json();
    if (!response.ok) {
      setState("error");
      setError(data.error ?? "Could not read that game.");
      return;
    }
    setSummary(data.summary);
    setPgn(data.pgn);
    setSource(data.source);
    setWarnings(data.warnings ?? []);
    setState("ready");
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-void/75 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="anim-pop w-full max-w-[640px] overflow-hidden rounded-dialog border border-line-strong bg-overlay shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]"
      >
        <header className="flex items-center justify-between border-b border-line bg-surface/60 px-4 py-3">
          <div>
            <h2 id="import-title" className="text-lead font-bold">
              Import a game
            </h2>
            <p className="text-note text-faint">
              Paste PGN, or drop a Lichess game URL. It joins this room&apos;s game list.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className={button({ intent: "ghost", size: "icon" })}
          >
            ✕
          </button>
        </header>

        <div className="p-4">
          <label htmlFor="pgn-input" className={fieldLabel()}>
            PGN or Lichess URL
          </label>
          <textarea
            id="pgn-input"
            ref={areaRef}
            rows={7}
            spellCheck={false}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setState("idle");
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (text.trim()) setTimeout(() => preview(text), 0);
            }}
            placeholder={"https://lichess.org/abcd1234\n\n— or —\n\n[Event \"...\"]\n1. e4 e5 2. Nf3 …"}
            aria-invalid={state === "error"}
            aria-describedby="pgn-help"
            className={textarea({ invalid: state === "error" }) + " font-mono text-note"}
          />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p id="pgn-help" className={helpText({ tone: state === "error" ? "bad" : "muted" })}>
              {state === "error" ? (
                <>
                  <span aria-hidden>⚠</span>
                  <span>{error}</span>
                </>
              ) : (
                <span>Pasting previews automatically. Variations and {"{comments}"} are preserved.</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setInput(SAMPLE);
                preview(SAMPLE);
              }}
              className={button({ intent: "ghost", size: "xs" })}
            >
              Use sample
            </button>
          </div>

          {/* preview */}
          <div className="mt-3 rounded-panel border border-line bg-panel p-3">
            <h3 className={panelTitle() + " mb-2"}>Preview</h3>
            {state === "loading" && (
              <p className="flex items-center gap-2 text-note text-muted">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
                Parsing…
              </p>
            )}
            {state === "idle" && (
              <p className="text-note text-faint">
                Nothing parsed yet — the players, event, result and node counts
                will appear here.
              </p>
            )}
            {state === "error" && (
              <p className="text-note text-bad-hi">
                Could not parse. Fix the input above and try again — nothing was
                added to the room.
              </p>
            )}
            {state === "ready" && summary && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-ink">
                    {summary.white}
                    {summary.whiteElo ? ` (${summary.whiteElo})` : ""}
                  </span>
                  <span className="text-faint">vs</span>
                  <span className="text-body font-semibold text-ink">
                    {summary.black}
                    {summary.blackElo ? ` (${summary.blackElo})` : ""}
                  </span>
                  <span className={chip({ tone: "outline" })}>{summary.result}</span>
                  <span className={chip({ tone: source === "lichess" ? "info" : "neutral" })}>
                    {source}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-note sm:grid-cols-4">
                  {[
                    ["Event", summary.event],
                    ["Date", summary.date ?? "—"],
                    ["Opening", summary.opening ?? summary.eco ?? "—"],
                    ["Size", `${summary.plies} ply · ${summary.nodes} nodes`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-faint">{k}</dt>
                      <dd className="truncate text-muted" title={v}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                {warnings.length > 0 && (
                  <p className={helpText({ tone: "bad" })}>
                    <span aria-hidden>⚠</span>
                    <span>
                      {warnings.length} token{warnings.length > 1 ? "s" : ""} skipped:{" "}
                      {warnings.slice(0, 2).join("; ")}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line bg-surface/60 px-4 py-3">
          <p className="text-micro text-faint">
            Imports are shared with everyone in the room.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={button({ intent: "secondary" })}>
              Cancel
            </button>
            <button
              type="button"
              disabled={state !== "ready" || busy}
              onClick={async () => {
                await onImport(pgn, source);
                setInput("");
                setState("idle");
                setSummary(null);
              }}
              className={button({ intent: "primary" })}
            >
              {busy ? "Importing…" : "Import game"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
