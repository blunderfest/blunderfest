import {
  applyMove,
  fromSan,
  parseFen,
  START_FEN,
  toFen,
  toSan,
  uciOf,
} from "./chess";

export interface PgnNode {
  san: string;
  uci: string;
  fen: string;
  comment: string | null;
  children: PgnNode[];
}

export interface ParsedGame {
  headers: Record<string, string>;
  root: PgnNode[]; // main line + siblings at ply 1
  plies: number; // main line length
  nodes: number; // total nodes incl. variations
  errors: string[];
}

export interface ParseResult {
  ok: boolean;
  game?: ParsedGame;
  error?: string;
}

type Token =
  | { t: "move"; v: string }
  | { t: "comment"; v: string }
  | { t: "open" }
  | { t: "close" }
  | { t: "result"; v: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "{") {
      const end = text.indexOf("}", i);
      const stop = end === -1 ? text.length : end;
      tokens.push({ t: "comment", v: text.slice(i + 1, stop).trim() });
      i = stop + 1;
      continue;
    }
    if (ch === ";") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      tokens.push({ t: "comment", v: text.slice(i + 1, stop).trim() });
      i = stop + 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ t: "open" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ t: "close" });
      i++;
      continue;
    }
    const rest = text.slice(i);
    const result = rest.match(/^(1-0|0-1|1\/2-1\/2|\*)/);
    if (result) {
      tokens.push({ t: "result", v: result[0] });
      i += result[0].length;
      continue;
    }
    const nag = rest.match(/^\$\d+/);
    if (nag) {
      i += nag[0].length;
      continue;
    }
    const num = rest.match(/^\d+\.(\.\.)?/);
    if (num) {
      i += num[0].length;
      continue;
    }
    const move = rest.match(/^[A-Za-z0-9+#=\-!?]+/);
    if (move) {
      tokens.push({ t: "move", v: move[0] });
      i += move[0].length;
      continue;
    }
    i++;
  }
  return tokens;
}

export function parsePgn(pgnText: string): ParseResult {
  const text = pgnText.trim();
  if (!text) return { ok: false, error: "Nothing to import — paste a PGN." };

  const headers: Record<string, string> = {};
  const headerRe = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text))) headers[m[1]] = m[2];

  const movetext = text.replace(headerRe, "").trim();
  const tokens = tokenize(movetext);
  if (!tokens.some((t) => t.t === "move")) {
    return {
      ok: false,
      error:
        "No moves found. A PGN needs movetext like `1. e4 e5 2. Nf3` after the header tags.",
    };
  }

  const startFen = headers["FEN"] ?? START_FEN;
  let position;
  try {
    position = parseFen(startFen);
    toFen(position);
  } catch {
    return { ok: false, error: `Unreadable FEN header: ${startFen}` };
  }

  const errors: string[] = [];
  let nodeCount = 0;
  let index = 0;

  /**
   * Parses one line starting from `startFen` and returns its first node.
   * `siblings` is the list a variation should be appended to when the line's
   * very first move has an alternative (i.e. `(...)` before any move here).
   */
  function parseSpine(startFen: string, siblings: PgnNode[]): PgnNode | null {
    let head: PgnNode | null = null;
    let last: PgnNode | null = null;
    let parentOfLast: PgnNode | null = null;
    let fenBefore = startFen; // position the next move is played from
    let fenBeforeLast = startFen; // position `last` was played from

    while (index < tokens.length) {
      const token = tokens[index];
      if (token.t === "close") {
        index++;
        break;
      }
      if (token.t === "result") {
        index++;
        continue;
      }
      if (token.t === "comment") {
        index++;
        if (last) last.comment = token.v;
        continue;
      }
      if (token.t === "open") {
        index++;
        const host = parentOfLast ? parentOfLast.children : siblings;
        const branch = parseSpine(fenBeforeLast, host);
        if (branch) host.push(branch);
        continue;
      }
      index++;
      const pos = parseFen(fenBefore);
      const move = fromSan(pos, token.v);
      if (!move) {
        errors.push(`Skipped unreadable move "${token.v}"`);
        continue;
      }
      const san = toSan(pos, move);
      const next = applyMove(pos, move);
      const node: PgnNode = {
        san,
        uci: uciOf(move),
        fen: toFen(next),
        comment: null,
        children: [],
      };
      nodeCount++;
      if (last) last.children.push(node);
      else head = node;
      parentOfLast = last;
      last = node;
      fenBeforeLast = fenBefore;
      fenBefore = node.fen;
    }
    return head;
  }

  const root: PgnNode[] = [];
  const first = parseSpine(toFen(position), root);
  if (first) root.unshift(first);

  let plies = 0;
  let cursor: PgnNode | undefined = root[0];
  while (cursor) {
    plies++;
    cursor = cursor.children[0];
  }

  return {
    ok: true,
    game: {
      headers,
      root,
      plies,
      nodes: nodeCount,
      errors,
    },
  };
}

export function lichessGameId(input: string): string | null {
  const match = input
    .trim()
    .match(
      /^(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:study\/)?([A-Za-z0-9]{8,12})/,
    );
  if (!match) return null;
  return match[1].slice(0, 8);
}

export function summarize(game: ParsedGame) {
  const h = game.headers;
  return {
    white: h["White"] ?? "Unknown",
    black: h["Black"] ?? "Unknown",
    whiteElo: h["WhiteElo"] ?? null,
    blackElo: h["BlackElo"] ?? null,
    event: h["Event"] ?? "Casual game",
    site: h["Site"] ?? null,
    date: h["Date"] ?? h["UTCDate"] ?? null,
    result: h["Result"] ?? "*",
    eco: h["ECO"] ?? null,
    opening: h["Opening"] ?? null,
    plies: game.plies,
    nodes: game.nodes,
  };
}
