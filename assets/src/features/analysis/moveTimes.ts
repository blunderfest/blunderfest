import type { GameNode, GameTree } from '@/lib/api';

export type MoveTime = { ply: number; seconds: number };

/**
 * The initial clock and increment from the `TimeControl` header
 * (`"300+3"`, `"180"`); null when absent or not a simple control
 * (sandbaggers like `"?"`, `"-"`, or per-move formats).
 */
export function timeControl(headers: Record<string, string>): {
  initial: number;
  increment: number;
} | null {
  const value = headers.TimeControl;
  if (value === undefined) {
    return null;
  }
  const match = /^(\d+)(?:\+(\d+))?$/.exec(value);
  if (match === null) {
    return null;
  }
  const initial = Number(match[1]);
  const increment = match[2] === undefined ? 0 : Number(match[2]);
  return { initial, increment };
}

/**
 * How long each mainline move took (visualization ideas #10): the mover's
 * clock drop across the move plus the increment, from the `[%clk]` values
 * the server parser extracts into `node.clock`. The first move measures
 * against the initial clock from `TimeControl`; without the header (or
 * without clock data at all) those points are simply absent — a game needs
 * both a clocked source and, for ply 1, a sane TimeControl to chart every
 * move.
 */
export function moveTimes(tree: GameTree): MoveTime[] {
  const control = timeControl(tree.headers);

  const times: MoveTime[] = [];
  let node: GameNode | null = tree.root;
  let previous: number | null = null;

  while (node !== null) {
    if (node.ply > 0 && node.clock !== null && node.clock !== undefined) {
      const before = node.ply === 1 ? (control?.initial ?? null) : previous;
      if (before !== null) {
        // The increment lands after every move, the first included
        // (Lichess/Chess.com convention: clock_after = clock_before −
        // spent + increment).
        const increment = control?.increment ?? 0;
        const seconds = before - node.clock + increment;
        if (seconds >= 0) {
          times.push({ ply: node.ply, seconds });
        }
      }
      previous = node.clock;
    } else {
      // A move without clock data breaks the chain: the next clocked move
      // has no "before" to measure against.
      previous = null;
    }
    node = node.children[0] ?? null;
  }
  return times;
}
