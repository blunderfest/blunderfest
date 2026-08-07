/**
 * Minimal but complete chess rules engine.
 * Board is a 64-length array, index 0 = a8 ... 63 = h1, FEN piece chars.
 */

export type Piece = string; // "P","N","B","R","Q","K" (white) / lowercase (black)
export type Color = "w" | "b";

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castling: string; // "KQkq" subset, "-" => ""
  ep: number | null; // index of en-passant target square
  half: number;
  full: number;
}

export interface Move {
  from: number;
  to: number;
  piece: Piece;
  captured?: Piece | null;
  promotion?: "q" | "r" | "b" | "n";
  castle?: "K" | "Q";
  ep?: boolean;
}

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const FILES = "abcdefgh";

export const fileOf = (i: number) => i & 7;
export const rankOf = (i: number) => i >> 3; // 0 = rank 8
export const squareName = (i: number) => FILES[fileOf(i)] + (8 - rankOf(i));
export const squareIndex = (s: string) =>
  FILES.indexOf(s[0]) + (8 - Number(s[1])) * 8;
export const isWhite = (p: Piece) => p === p.toUpperCase();
export const colorOf = (p: Piece): Color => (isWhite(p) ? "w" : "b");
export const isLightSquare = (i: number) => (fileOf(i) + rankOf(i)) % 2 === 0;

export function parseFen(fen: string): Position {
  const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board: (Piece | null)[] = new Array(64).fill(null);
  let i = 0;
  for (const ch of placement) {
    if (ch === "/") continue;
    if (ch >= "1" && ch <= "8") i += Number(ch);
    else board[i++] = ch;
  }
  return {
    board,
    turn: turn === "b" ? "b" : "w",
    castling: castling && castling !== "-" ? castling : "",
    ep: ep && ep !== "-" ? squareIndex(ep) : null,
    half: Number(half ?? 0) || 0,
    full: Number(full ?? 1) || 1,
  };
}

export function toFen(p: Position): string {
  let out = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const piece = p.board[r * 8 + f];
      if (!piece) empty++;
      else {
        if (empty) out += empty;
        empty = 0;
        out += piece;
      }
    }
    if (empty) out += empty;
    if (r < 7) out += "/";
  }
  return `${out} ${p.turn} ${p.castling || "-"} ${
    p.ep === null ? "-" : squareName(p.ep)
  } ${p.half} ${p.full}`;
}

const KNIGHT = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
];
const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function onBoard(f: number, r: number) {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

/** Pseudo-legal moves for the side to move (no king-safety filter). */
function pseudoMoves(p: Position, onlyFrom?: number): Move[] {
  const moves: Move[] = [];
  const me = p.turn;
  const dir = me === "w" ? -1 : 1; // rank delta on the array (0 = rank 8)
  for (let i = 0; i < 64; i++) {
    if (onlyFrom !== undefined && i !== onlyFrom) continue;
    const piece = p.board[i];
    if (!piece || colorOf(piece) !== me) continue;
    const f = fileOf(i);
    const r = rankOf(i);
    const type = piece.toLowerCase();

    if (type === "p") {
      const one = i + dir * 8;
      const startRank = me === "w" ? 6 : 1;
      const promoRank = me === "w" ? 0 : 7;
      if (onBoard(f, r + dir) && !p.board[one]) {
        pushPawn(moves, { from: i, to: one, piece }, rankOf(one) === promoRank);
        const two = i + dir * 16;
        if (r === startRank && !p.board[two])
          moves.push({ from: i, to: two, piece });
      }
      for (const df of [-1, 1]) {
        const nf = f + df;
        const nr = r + dir;
        if (!onBoard(nf, nr)) continue;
        const t = nr * 8 + nf;
        const target = p.board[t];
        if (target && colorOf(target) !== me) {
          pushPawn(
            moves,
            { from: i, to: t, piece, captured: target },
            nr === promoRank,
          );
        } else if (p.ep === t) {
          moves.push({
            from: i,
            to: t,
            piece,
            ep: true,
            captured: me === "w" ? "p" : "P",
          });
        }
      }
    } else if (type === "n" || type === "k") {
      const deltas = type === "n" ? KNIGHT : [...DIAG, ...ORTHO];
      for (const [df, dr] of deltas) {
        const nf = f + df;
        const nr = r + dr;
        if (!onBoard(nf, nr)) continue;
        const t = nr * 8 + nf;
        const target = p.board[t];
        if (target && colorOf(target) === me) continue;
        moves.push({ from: i, to: t, piece, captured: target });
      }
      if (type === "k") {
        const rights = me === "w" ? ["K", "Q"] : ["k", "q"];
        const homeRank = me === "w" ? 7 : 0;
        if (i === homeRank * 8 + 4 && !inCheck(p, me)) {
          if (
            p.castling.includes(rights[0]) &&
            !p.board[i + 1] &&
            !p.board[i + 2] &&
            !attacked(p, i + 1, other(me)) &&
            !attacked(p, i + 2, other(me))
          )
            moves.push({ from: i, to: i + 2, piece, castle: "K" });
          if (
            p.castling.includes(rights[1]) &&
            !p.board[i - 1] &&
            !p.board[i - 2] &&
            !p.board[i - 3] &&
            !attacked(p, i - 1, other(me)) &&
            !attacked(p, i - 2, other(me))
          )
            moves.push({ from: i, to: i - 2, piece, castle: "Q" });
        }
      }
    } else {
      const rays =
        type === "b" ? DIAG : type === "r" ? ORTHO : [...DIAG, ...ORTHO];
      for (const [df, dr] of rays) {
        let nf = f + df;
        let nr = r + dr;
        while (onBoard(nf, nr)) {
          const t = nr * 8 + nf;
          const target = p.board[t];
          if (target && colorOf(target) === me) break;
          moves.push({ from: i, to: t, piece, captured: target });
          if (target) break;
          nf += df;
          nr += dr;
        }
      }
    }
  }
  return moves;
}

function pushPawn(moves: Move[], base: Move, promo: boolean) {
  if (!promo) {
    moves.push(base);
    return;
  }
  for (const pr of ["q", "r", "b", "n"] as const)
    moves.push({ ...base, promotion: pr });
}

export const other = (c: Color): Color => (c === "w" ? "b" : "w");

export function attacked(p: Position, sq: number, by: Color): boolean {
  const f = fileOf(sq);
  const r = rankOf(sq);
  // pawns
  const pdir = by === "w" ? 1 : -1; // attacker sits "below" the square
  for (const df of [-1, 1]) {
    const nf = f + df;
    const nr = r + pdir;
    if (onBoard(nf, nr)) {
      const t = p.board[nr * 8 + nf];
      if (t && colorOf(t) === by && t.toLowerCase() === "p") return true;
    }
  }
  for (const [df, dr] of KNIGHT) {
    const nf = f + df;
    const nr = r + dr;
    if (!onBoard(nf, nr)) continue;
    const t = p.board[nr * 8 + nf];
    if (t && colorOf(t) === by && t.toLowerCase() === "n") return true;
  }
  for (const [df, dr] of [...DIAG, ...ORTHO]) {
    const nf = f + df;
    const nr = r + dr;
    if (!onBoard(nf, nr)) continue;
    const t = p.board[nr * 8 + nf];
    if (t && colorOf(t) === by && t.toLowerCase() === "k") return true;
  }
  for (const [df, dr] of DIAG) {
    let nf = f + df;
    let nr = r + dr;
    while (onBoard(nf, nr)) {
      const t = p.board[nr * 8 + nf];
      if (t) {
        if (colorOf(t) === by && "bq".includes(t.toLowerCase())) return true;
        break;
      }
      nf += df;
      nr += dr;
    }
  }
  for (const [df, dr] of ORTHO) {
    let nf = f + df;
    let nr = r + dr;
    while (onBoard(nf, nr)) {
      const t = p.board[nr * 8 + nf];
      if (t) {
        if (colorOf(t) === by && "rq".includes(t.toLowerCase())) return true;
        break;
      }
      nf += df;
      nr += dr;
    }
  }
  return false;
}

export function kingSquare(p: Position, c: Color): number {
  const k = c === "w" ? "K" : "k";
  return p.board.indexOf(k);
}

export function inCheck(p: Position, c: Color): boolean {
  const ks = kingSquare(p, c);
  if (ks < 0) return false;
  return attacked(p, ks, other(c));
}

export function applyMove(p: Position, m: Move): Position {
  const board = p.board.slice();
  const me = p.turn;
  board[m.from] = null;
  board[m.to] = m.promotion
    ? me === "w"
      ? m.promotion.toUpperCase()
      : m.promotion
    : m.piece;
  if (m.ep) board[m.to + (me === "w" ? 8 : -8)] = null;
  if (m.castle === "K") {
    board[m.to - 1] = board[m.to + 1];
    board[m.to + 1] = null;
  }
  if (m.castle === "Q") {
    board[m.to + 1] = board[m.to - 2];
    board[m.to - 2] = null;
  }

  let castling = p.castling;
  const drop = (s: string) => {
    for (const ch of s) castling = castling.replace(ch, "");
  };
  const type = m.piece.toLowerCase();
  if (type === "k") drop(me === "w" ? "KQ" : "kq");
  if (m.from === 63 || m.to === 63) drop("K");
  if (m.from === 56 || m.to === 56) drop("Q");
  if (m.from === 7 || m.to === 7) drop("k");
  if (m.from === 0 || m.to === 0) drop("q");

  const ep =
    type === "p" && Math.abs(m.to - m.from) === 16
      ? (m.from + m.to) / 2
      : null;

  return {
    board,
    turn: other(me),
    castling,
    ep,
    half: type === "p" || m.captured ? 0 : p.half + 1,
    full: me === "b" ? p.full + 1 : p.full,
  };
}

export function legalMoves(p: Position, from?: number): Move[] {
  return pseudoMoves(p, from).filter((m) => !inCheck(applyMove(p, m), p.turn));
}

export type Status = "playing" | "checkmate" | "stalemate" | "draw";

export function statusOf(p: Position): Status {
  const moves = legalMoves(p);
  if (moves.length === 0) return inCheck(p, p.turn) ? "checkmate" : "stalemate";
  if (p.half >= 100) return "draw";
  return "playing";
}

export function toSan(p: Position, m: Move): string {
  if (m.castle) {
    const base = m.castle === "K" ? "O-O" : "O-O-O";
    return base + suffix(p, m);
  }
  const type = m.piece.toLowerCase();
  let san = "";
  if (type === "p") {
    if (m.captured) san += FILES[fileOf(m.from)] + "x";
    san += squareName(m.to);
    if (m.promotion) san += "=" + m.promotion.toUpperCase();
  } else {
    san += m.piece.toUpperCase();
    const rivals = legalMoves(p).filter(
      (x) =>
        x.to === m.to &&
        x.from !== m.from &&
        x.piece.toLowerCase() === type &&
        colorOf(x.piece) === colorOf(m.piece),
    );
    if (rivals.length) {
      const sameFile = rivals.some((x) => fileOf(x.from) === fileOf(m.from));
      const sameRank = rivals.some((x) => rankOf(x.from) === rankOf(m.from));
      if (!sameFile) san += FILES[fileOf(m.from)];
      else if (!sameRank) san += String(8 - rankOf(m.from));
      else san += squareName(m.from);
    }
    if (m.captured) san += "x";
    san += squareName(m.to);
  }
  return san + suffix(p, m);
}

function suffix(p: Position, m: Move): string {
  const next = applyMove(p, m);
  if (!inCheck(next, next.turn)) return "";
  return legalMoves(next).length === 0 ? "#" : "+";
}

export function fromSan(p: Position, san: string): Move | null {
  const clean = san.replace(/[+#?!]+$/g, "").replace(/[!?]/g, "");
  for (const m of legalMoves(p)) {
    const candidate = toSan(p, m).replace(/[+#]/g, "");
    if (candidate === clean) return m;
  }
  // tolerate 0-0 style and sloppy input
  const alt = clean.replace(/0/g, "O");
  for (const m of legalMoves(p)) {
    if (toSan(p, m).replace(/[+#]/g, "") === alt) return m;
  }
  return null;
}

export function uciOf(m: Move): string {
  return squareName(m.from) + squareName(m.to) + (m.promotion ?? "");
}

/** Move number label. `variationStart` forces the "2..." black form. */
export function moveLabel(ply: number, variationStart = false): string | null {
  const isWhiteMove = ply % 2 === 1;
  const number = Math.ceil(ply / 2);
  if (isWhiteMove) return `${number}.`;
  if (variationStart) return `${number}...`;
  return null;
}

export const PIECE_GLYPH: Record<string, string> = {
  K: "\u2654",
  Q: "\u2655",
  R: "\u2656",
  B: "\u2657",
  N: "\u2658",
  P: "\u2659",
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

export const PIECE_NAME: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};
