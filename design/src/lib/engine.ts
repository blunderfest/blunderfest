/**
 * Blunderfest's fallback analysis engine.
 *
 * The production room loads Stockfish WASM; when that is unavailable (locked
 * down browser, no SharedArrayBuffer, offline) the room falls back to this
 * small alpha-beta search so the eval bar still has something honest to show.
 * The UI labels the difference — see EngineReadout `variant="fallback"`.
 */
import {
  Position,
  applyMove,
  colorOf,
  inCheck,
  legalMoves,
  parseFen,
  toSan,
  Move,
} from "./chess";

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// prettier-ignore
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20],
};

/** Static eval in centipawns, positive = white better. */
function evaluate(p: Position): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const piece = p.board[i];
    if (!piece) continue;
    const type = piece.toLowerCase();
    const white = colorOf(piece) === "w";
    const table = PST[type];
    // PST are written from White's perspective (index 0 = a8), mirror for Black
    const pst = white ? table[i] : table[(7 - (i >> 3)) * 8 + (i & 7)];
    score += (white ? 1 : -1) * (VALUE[type] + pst * 0.9);
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    const av = (a.captured ? VALUE[a.captured.toLowerCase()] : 0) + (a.promotion ? 800 : 0);
    const bv = (b.captured ? VALUE[b.captured.toLowerCase()] : 0) + (b.promotion ? 800 : 0);
    return bv - av;
  });
}

const QUIESCE_DEPTH = 2;

function quiesce(p: Position, alpha: number, beta: number, depth: number): number {
  const sign = p.turn === "w" ? 1 : -1;
  const stand = sign * evaluate(p);
  if (depth === 0) return stand;
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  for (const m of orderMoves(legalMoves(p).filter((x) => x.captured))) {
    const score = -quiesce(applyMove(p, m), -beta, -alpha, depth - 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

interface SearchResult {
  score: number; // centipawns from side to move
  line: Move[];
  mate?: number;
}

function search(
  p: Position,
  depth: number,
  alpha: number,
  beta: number,
): SearchResult {
  const moves = orderMoves(legalMoves(p));
  if (moves.length === 0) {
    if (inCheck(p, p.turn)) return { score: -100000 - depth, line: [], mate: 0 };
    return { score: 0, line: [] };
  }
  if (depth === 0) return { score: quiesce(p, alpha, beta, QUIESCE_DEPTH), line: [] };

  let best: SearchResult = { score: -Infinity, line: [] };
  for (const m of moves) {
    const child = search(applyMove(p, m), depth - 1, -beta, -alpha);
    const score = -child.score;
    if (score > best.score) best = { score, line: [m, ...child.line] };
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

export interface EngineEval {
  /** centipawns from white's point of view */
  cp: number | null;
  /** positive = white mates in N, negative = black mates in N */
  mate: number | null;
  depth: number;
  pv: string[]; // SAN
  bestMove: string | null;
  gameOver: "checkmate" | "stalemate" | null;
}

export function analyse(fen: string, depth = 3): EngineEval {
  const p = parseFen(fen);
  const roots = legalMoves(p);
  if (roots.length === 0) {
    const mated = inCheck(p, p.turn);
    return {
      cp: mated ? (p.turn === "w" ? -10000 : 10000) : 0,
      mate: mated ? 0 : null,
      depth: 0,
      pv: [],
      bestMove: null,
      gameOver: mated ? "checkmate" : "stalemate",
    };
  }
  const result = search(p, depth, -Infinity, Infinity);
  const sign = p.turn === "w" ? 1 : -1;

  // SAN-ify the principal variation
  const pv: string[] = [];
  let cursor = p;
  for (const m of result.line.slice(0, 6)) {
    const legal = legalMoves(cursor).find(
      (x) => x.from === m.from && x.to === m.to && x.promotion === m.promotion,
    );
    if (!legal) break;
    pv.push(toSan(cursor, legal));
    cursor = applyMove(cursor, legal);
  }

  const mateScore = Math.abs(result.score) > 90000;
  const pliesToMate = mateScore ? Math.ceil(result.line.length / 2) || 1 : null;

  return {
    cp: mateScore ? null : Math.round(sign * result.score),
    mate: mateScore
      ? (result.score > 0 ? sign : -sign) * (pliesToMate ?? 1)
      : null,
    depth,
    pv,
    bestMove: pv[0] ?? null,
    gameOver: null,
  };
}

/**
 * Chunked root search: one root move per `step()` so the browser can paint
 * between candidates. This is what keeps the "thinking" state honest — the
 * eval bar improves progressively instead of freezing the tab.
 */
export function rootSearcher(fen: string, depth: number) {
  const root = parseFen(fen);
  const sign = root.turn === "w" ? 1 : -1;
  const moves = orderMoves(legalMoves(root));
  let index = 0;
  let best: SearchResult = { score: -Infinity, line: [] };

  const pack = (): EngineEval => {
    if (moves.length === 0) {
      const mated = inCheck(root, root.turn);
      return {
        cp: mated ? (root.turn === "w" ? -10000 : 10000) : 0,
        mate: mated ? 0 : null,
        depth,
        pv: [],
        bestMove: null,
        gameOver: mated ? "checkmate" : "stalemate",
      };
    }
    const pv: string[] = [];
    let cursor = root;
    for (const m of best.line.slice(0, 6)) {
      const legal = legalMoves(cursor).find(
        (x) => x.from === m.from && x.to === m.to && x.promotion === m.promotion,
      );
      if (!legal) break;
      pv.push(toSan(cursor, legal));
      cursor = applyMove(cursor, legal);
    }
    const isMate = Math.abs(best.score) > 90000;
    const pliesToMate = Math.max(1, Math.ceil(best.line.length / 2));
    return {
      cp: isMate ? null : Math.round(sign * best.score),
      mate: isMate ? (best.score > 0 ? sign : -sign) * pliesToMate : null,
      depth,
      pv,
      bestMove: pv[0] ?? null,
      gameOver: null,
    };
  };

  return {
    total: moves.length,
    step(): { done: boolean; evaluation: EngineEval } {
      if (index >= moves.length) return { done: true, evaluation: pack() };
      const move = moves[index++];
      const child = search(applyMove(root, move), depth - 1, -Infinity, -best.score);
      const score = -child.score;
      if (score > best.score) best = { score, line: [move, ...child.line] };
      return { done: index >= moves.length, evaluation: pack() };
    },
  };
}

/** "+1.25" / "-0.40" / "M3" / "-M2" */
export function formatEval(e: Pick<EngineEval, "cp" | "mate">): string {
  if (e.mate !== null && e.mate !== undefined) {
    if (e.mate === 0) return "#";
    return `${e.mate < 0 ? "-" : ""}M${Math.abs(e.mate)}`;
  }
  if (e.cp === null || e.cp === undefined) return "0.00";
  const pawns = e.cp / 100;
  return `${pawns > 0 ? "+" : pawns < 0 ? "\u2212" : ""}${Math.abs(pawns).toFixed(2)}`;
}

/** White's share of the eval bar, 0..1 (logistic squash, clamped 2..98%). */
export function whiteShare(e: Pick<EngineEval, "cp" | "mate">): number {
  if (e.mate !== null && e.mate !== undefined) return e.mate > 0 ? 1 : e.mate < 0 ? 0 : 0.5;
  const cp = Math.max(-1500, Math.min(1500, e.cp ?? 0));
  return 1 / (1 + Math.exp(-cp / 320));
}

/** Spoken form for screen readers / live regions. */
export function describeEval(e: Pick<EngineEval, "cp" | "mate">): string {
  if (e.mate) return `Mate in ${Math.abs(e.mate)} for ${e.mate > 0 ? "White" : "Black"}`;
  const cp = e.cp ?? 0;
  if (Math.abs(cp) < 30) return "Equal position";
  const side = cp > 0 ? "White" : "Black";
  return `${side} is better by ${(Math.abs(cp) / 100).toFixed(2)} pawns`;
}
