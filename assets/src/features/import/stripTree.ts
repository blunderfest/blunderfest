import type { GameNode, GameTree } from '@/lib/api';

/**
 * Import-time stripping: a freshly imported game can carry more than the
 * room should see. Lichess exports annotate every move (`[%eval …]`,
 * `[%clk …]`); headers name the players; variations may be work the user
 * wants to redo themselves. The preview applies these live, so what's in
 * the preview is exactly what enters the room.
 *
 * "Engine annotations" are PGN comment commands (`[%eval 0.3]`,
 * `[%clk 0:05:00]`, ...) — machine data. Human comment text survives
 * stripping them; a comment that held only commands disappears entirely.
 */
export type StripOptions = {
  /** PGN comment commands: [%eval …], [%clk …], etc. */
  evaluations: boolean;
  /** Human comment text (and NAG glyphs). */
  comments: boolean;
  /** Headers — names, event, date. The game result stays. */
  metadata: boolean;
  /** Variations: keep only the mainline. */
  variations: boolean;
};

/**
 * The default: drop engine annotations (machine noise on Lichess exports),
 * keep everything human.
 */
export const DEFAULT_STRIP: StripOptions = {
  evaluations: true,
  comments: false,
  metadata: false,
  variations: false,
};

const COMMAND_MARKER = /\s*\[%[^\]]*\]/g;

/** The comment text without command markers; '' when only markers remain. */
function withoutCommands(text: string): string {
  return text.replaceAll(COMMAND_MARKER, ' ').replace(/\s+/g, ' ').trim();
}

/** Variation lines in the tree: every non-first child starts one. */
export function countVariations(node: GameNode): number {
  const here = Math.max(0, node.children.length - 1);
  return here + node.children.reduce((sum, child) => sum + countVariations(child), 0);
}

/** Any engine annotation anywhere in the tree. */
export function hasEvaluations(node: GameNode): boolean {
  return node.comment?.includes('[%') === true || node.children.some(hasEvaluations);
}

/** Any human comment text anywhere in the tree (beyond bare command markers). */
export function hasComments(node: GameNode): boolean {
  return (
    (node.comment !== null && withoutCommands(node.comment) !== '') ||
    node.children.some(hasComments)
  );
}

export function stripTree(tree: GameTree, options: StripOptions): GameTree {
  const stripNode = (node: GameNode): GameNode => {
    let comment = node.comment;
    if (options.comments) {
      comment = null;
    } else if (options.evaluations && comment !== null) {
      const cleaned = withoutCommands(comment);
      comment = cleaned === '' ? null : cleaned;
    }

    return {
      ...node,
      comment,
      nags: options.comments ? [] : node.nags,
      children: (options.variations ? node.children.slice(0, 1) : node.children).map(stripNode),
    };
  };

  const root = stripNode(tree.root);
  return {
    ...tree,
    headers: options.metadata ? {} : tree.headers,
    root,
    node_count: countNodes(root),
  };
}

function countNodes(node: GameNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}
