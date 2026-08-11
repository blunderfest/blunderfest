import type { GameNode, GameTree } from '@/lib/api';

/**
 * Serializes a game tree back to PGN: headers (seven-tag roster first), move
 * numbers, NAGs, comments, and variations in parentheses — the inverse of
 * the server's parser, so an export re-imports losslessly.
 *
 * Setup nodes (free-form position edits, ADR-0011) have no SAN and can't
 * live inside standard PGN movetext: they export as an inline
 * `{[FEN "..."]}` marker comment, and their continuation becomes its own
 * game appended to the output (with `SetUp`/`FEN` headers) — multi-game
 * PGNs are standard practice. Nested setup nodes are collected the same way.
 */

/** Conventional header order: the seven-tag roster, then the rest sorted. */
const SEVEN_TAGS = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];

type Emitter = { tokens: string[]; needsNumber: boolean };

export function gameToPgn(tree: GameTree): string {
  const setupGames: GameNode[] = [];
  const main = serializeGame(
    headerLines(tree.headers, tree.result, tree.setup),
    tree.result,
    tree.root,
    setupGames,
  );

  const games = [main];
  // Index loop: serializing a setup game can discover further nested ones.
  for (let i = 0; i < setupGames.length; i += 1) {
    const setupNode = setupGames[i];
    const headers = headerLines(
      {
        Event: `Analysis of ${tree.headers.White ?? '?'} vs ${tree.headers.Black ?? '?'}`,
        ...(tree.headers.Date !== undefined ? { Date: tree.headers.Date } : {}),
      },
      subtreeResult(setupNode),
      { fen: setupNode.fen ?? '' },
    );
    games.push(serializeGame(headers, subtreeResult(setupNode), setupNode, setupGames));
  }

  return `${games.join('\n\n')}\n`;
}

function serializeGame(
  headers: string[],
  result: string,
  root: GameNode,
  setupGames: GameNode[],
): string {
  const out: Emitter = { tokens: [], needsNumber: true };
  emitFrom(out, root, setupGames);
  out.tokens.push(result);
  return `${headers.join('\n')}\n\n${wrap(out.tokens)}`;
}

function headerLines(
  headers: Record<string, string>,
  result: string,
  setup: { fen?: string } | null,
): string[] {
  const merged: Record<string, string> = { ...headers, Result: result };
  if (setup?.fen !== undefined && setup.fen !== '') {
    merged.SetUp = '1';
    merged.FEN = setup.fen;
  }
  const lines: string[] = [];
  for (const tag of SEVEN_TAGS) {
    if (merged[tag] !== undefined) {
      lines.push(`[${tag} "${escapeHeader(merged[tag])}"]`);
    }
  }
  for (const key of Object.keys(merged).sort()) {
    if (!SEVEN_TAGS.includes(key)) {
      lines.push(`[${key} "${escapeHeader(merged[key])}"]`);
    }
  }
  return lines;
}

/** Emits the whole child line of `node` (mainline first, variations after the move they branch from). */
function emitFrom(out: Emitter, node: GameNode, setupGames: GameNode[]): void {
  let current = node;
  while (current.children.length > 0) {
    const [main, ...alts] = current.children;
    emitNodeText(out, main, setupGames);
    for (const alt of alts) {
      out.tokens.push('(');
      out.needsNumber = true;
      emitLine(out, alt, setupGames);
      out.tokens.push(')');
      out.needsNumber = true;
    }
    if (main.san === null) {
      // A setup node's continuation belongs to its own game (see above).
      break;
    }
    current = main;
  }
}

function emitLine(out: Emitter, first: GameNode, setupGames: GameNode[]): void {
  emitNodeText(out, first, setupGames);
  if (first.san !== null) {
    emitFrom(out, first, setupGames);
  }
}

function emitNodeText(out: Emitter, node: GameNode, setupGames: GameNode[]): void {
  if (node.san === null) {
    // A setup node: mark the spot; its continuation is a separate game.
    if (node.fen !== null) {
      out.tokens.push(`{[FEN "${node.fen}"]}`);
      out.needsNumber = true;
      if (node.children.length > 0) {
        setupGames.push(node);
      }
    }
    return;
  }

  if (node.ply % 2 === 1) {
    out.tokens.push(`${Math.ceil(node.ply / 2)}.`);
  } else if (out.needsNumber) {
    out.tokens.push(`${Math.ceil(node.ply / 2)}...`);
  }
  out.tokens.push(node.san);
  out.needsNumber = false;

  for (const nag of node.nags) {
    out.tokens.push(`$${nag}`);
  }
  if (node.comment !== null) {
    out.tokens.push(`{${escapeComment(node.comment)}}`);
    out.needsNumber = true;
  }
}

/** The result of a setup subtree: the outcome at the tip of its mainline, or `*`. */
function subtreeResult(setupNode: GameNode): string {
  let tip = setupNode;
  while (tip.children[0] !== undefined) {
    tip = tip.children[0];
  }
  if (tip.status === 'checkmate') {
    return tip.ply % 2 === 1 ? '1-0' : '0-1';
  }
  if (tip.status === 'stalemate' || tip.status === 'draw') {
    return '1/2-1/2';
  }
  return '*';
}

/** Downloads the game (plus any setup-analysis games) as a .pgn file. */
export function downloadPgn(tree: GameTree): void {
  const blob = new Blob([gameToPgn(tree)], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileNameFor(tree);
  anchor.click();
  URL.revokeObjectURL(url);
}

function fileNameFor(tree: GameTree): string {
  const white = tree.headers.White;
  const black = tree.headers.Black;
  const base = white !== undefined && black !== undefined ? `${white} vs ${black}` : 'game';
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe === '' ? 'game' : safe}.pgn`;
}

function escapeComment(text: string): string {
  return text.replaceAll('}', '\\}');
}

function escapeHeader(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

/** Joins tokens with spaces, wrapped to 80 columns; parens hug their movetext. */
function wrap(tokens: string[], width = 80): string {
  const lines: string[] = [];
  let line = '';
  let prefix = '';
  for (const token of tokens) {
    if (token === '(') {
      prefix += '(';
      continue;
    }
    if (token === ')') {
      line += ')';
      continue;
    }
    const piece = prefix + token;
    prefix = '';
    if (line === '') {
      line = piece;
    } else if (line.length + 1 + piece.length <= width) {
      line += ` ${piece}`;
    } else {
      lines.push(line);
      line = piece;
    }
  }
  if (line !== '') {
    lines.push(line);
  }
  return lines.join('\n');
}
