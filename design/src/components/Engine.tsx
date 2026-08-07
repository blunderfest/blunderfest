"use client";

import { useEffect, useRef, useState } from "react";
import {
  describeEval,
  formatEval,
  rootSearcher,
  whiteShare,
  type EngineEval,
} from "@/lib/engine";
import { statusDot } from "@/ui/variants";

export type EngineStatus = "idle" | "thinking" | "ready" | "unavailable";

/**
 * Iterative deepening on the main thread, yielded between depths so the UI
 * never janks. In production this is the Stockfish WASM worker; the shape of
 * the state (`status`, `evaluation`, `depth`) is identical either way.
 */
export function useEngine(fen: string, enabled = true) {
  const [evaluation, setEvaluation] = useState<EngineEval | null>(null);
  const [internalStatus, setStatus] = useState<EngineStatus>("idle");
  const timer = useRef<number | null>(null);
  const status: EngineStatus = enabled ? internalStatus : "unavailable";

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) window.clearTimeout(timer.current);
    let cancelled = false;
    // Iterative deepening; each depth is stepped one root move at a time so
    // the main thread stays responsive (a Stockfish worker does this for free).
    const depths = [1, 2, 3];
    let depthIndex = 0;
    let searcher = rootSearcher(fen, depths[0]);

    let announced = false;
    const pump = () => {
      if (cancelled) return;
      if (!announced) {
        announced = true;
        setStatus("thinking");
      }
      const budgetEnd = performance.now() + 12;
      let done = false;
      let latest: EngineEval | null = null;
      try {
        do {
          const step = searcher.step();
          latest = step.evaluation;
          done = step.done;
        } while (!done && performance.now() < budgetEnd);
      } catch {
        setStatus("unavailable");
        return;
      }
      if (latest) setEvaluation(latest);
      if (!done) {
        timer.current = window.setTimeout(pump, 0);
        return;
      }
      if (latest?.gameOver || depthIndex === depths.length - 1) {
        setStatus("ready");
        return;
      }
      depthIndex += 1;
      searcher = rootSearcher(fen, depths[depthIndex]);
      timer.current = window.setTimeout(pump, 0);
    };

    timer.current = window.setTimeout(pump, 30);
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [fen, enabled]);

  return { evaluation, status };
}

/* -------------------------------------------------------------------------- */

export function EvalBar({
  evaluation,
  status,
}: {
  evaluation: EngineEval | null;
  status: EngineStatus;
}) {
  const unavailable = status === "unavailable" || !evaluation;
  // Spec: White's share is drawn from the TOP of the bar.
  const share = evaluation ? whiteShare(evaluation) : 0.5;
  const label = evaluation ? formatEval(evaluation) : "--";
  const whiteAhead = share >= 0.5;

  return (
    <div
      className="relative flex h-full w-7 shrink-0 self-stretch flex-col overflow-hidden rounded-[5px] border border-line bg-[#0d0f13]"
      role="img"
      aria-label={
        unavailable
          ? "Engine evaluation unavailable"
          : describeEval(evaluation)
      }
      title={unavailable ? "Engine unavailable" : describeEval(evaluation)}
    >
      {/* white share */}
      <div
        className="w-full bg-gradient-to-b from-[#f4f6fb] to-[#c9cedb] transition-[height] duration-[420ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]"
        style={{ height: `${Math.round(share * 100)}%`, opacity: unavailable ? 0.18 : 1 }}
      />
      {/* black share is the remaining track */}
      <div className="flex-1 bg-[#1a1d24]" />

      {/* equality tick */}
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-line-strong/80" />

      {status === "thinking" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="anim-sweep h-1/3 w-full bg-gradient-to-b from-transparent via-gold/25 to-transparent" />
        </div>
      )}

      <span
        className={[
          "pointer-events-none absolute inset-x-0 tnum text-center text-[10px] font-bold tracking-tight",
          whiteAhead ? "top-1 text-[#20242c]" : "bottom-1 text-[#e8eaf0]",
        ].join(" ")}
      >
        {unavailable ? "" : label}
      </span>

      {unavailable && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-bold text-faint">
          ?
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function EngineReadout({
  evaluation,
  status,
  onRetry,
  turn,
  fullmove,
}: {
  evaluation: EngineEval | null;
  status: EngineStatus;
  onRetry?: () => void;
  turn: "w" | "b";
  fullmove: number;
}) {
  if (status === "unavailable")
    return (
      <div className="flex h-9 items-center gap-2 rounded-control border border-line bg-panel px-2.5 text-note text-muted">
        <span className={statusDot({ tone: "bad" })} />
        <span>
          Engine unavailable — this browser blocks WebAssembly threads. Analysis
          still syncs; evals are off.
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-auto rounded-chip px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide text-gold-hi hover:bg-gold/15"
          >
            Retry
          </button>
        )}
      </div>
    );

  const pv = evaluation?.pv ?? [];
  return (
    <div
      className="flex h-9 items-center gap-2 overflow-hidden rounded-control border border-line bg-panel px-2.5"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        className={statusDot({
          tone: status === "thinking" ? "warn" : "ok",
          pulse: status === "thinking",
        })}
      />
      <span className="shrink-0 text-micro font-semibold uppercase tracking-[0.1em] text-faint">
        {status === "thinking" ? "Thinking" : "Depth"}{" "}
        <span className="tnum text-muted">{evaluation?.depth ?? 0}</span>
      </span>
      <span
        className={`tnum shrink-0 rounded-chip px-1.5 py-0.5 text-ui font-bold ${
          (evaluation?.cp ?? 0) >= 0 || (evaluation?.mate ?? 0) > 0
            ? "bg-[#f2f4f8] text-[#14161b]"
            : "bg-[#22262f] text-ink"
        }`}
      >
        {evaluation ? formatEval(evaluation) : "\u2014"}
      </span>
      <span className="truncate text-ui text-muted tnum">
        {evaluation?.gameOver === "checkmate"
          ? "Checkmate — game over"
          : evaluation?.gameOver === "stalemate"
            ? "Stalemate — draw"
            : pv.length
              ? pv
                  .map((san, i) => {
                    const ply = i;
                    const white = turn === "w" ? ply % 2 === 0 : ply % 2 === 1;
                    const number = fullmove + Math.floor((ply + (turn === "b" ? 1 : 0)) / 2);
                    if (white) return `${number}. ${san}`;
                    return i === 0 ? `${number}... ${san}` : san;
                  })
                  .join(" ")
              : "Evaluating…"}
      </span>
    </div>
  );
}
