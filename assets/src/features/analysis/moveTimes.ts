import type { GameNode, GameTree } from '@/lib/api';

export type MoveTime = { ply: number; mover: 'w' | 'b'; seconds: number };

/** A side's remaining clock after each of its moves (from `[%clk]`). */
export type ClockPoint = { ply: number; mover: 'w' | 'b'; remaining: number };

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
 * How long each mainline move took (visualization ideas #10). White and
 * black keep separate clocks: a move's think time is the *mover's own*
 * clock drop plus the increment (`before − after + inc`, the Lichess
 * convention). A side's first move measures against the initial clock
 * from `TimeControl`; without the header those points are absent. An
 * unclocked move breaks only that side's chain — the next clocked move
 * of the same side has no "before", the opponent's times stay exact.
 */
export function moveTimes(tree: GameTree): MoveTime[] {
  const control = timeControl(tree.headers);

  const times: MoveTime[] = [];
  /** The last seen clock per side; null once the side's chain is broken. */
  const lastClock: { w: number | null; b: number | null } = { w: null, b: null };
  /** Whether a side has played a (clocked or unclocked) mainline move yet. */
  const seen: { w: boolean; b: boolean } = { w: false, b: false };
  let node: GameNode | null = tree.root;

  while (node !== null) {
    if (node.ply > 0) {
      const mover: 'w' | 'b' = node.ply % 2 === 1 ? 'w' : 'b';
      const clock = node.clock;
      if (clock !== null && clock !== undefined) {
        // A side's first move starts from the initial clock; after that,
        // its own previous clock. A broken chain (an unclocked move in
        // between) leaves no "before" — the point is unmeasurable.
        const before = seen[mover] ? lastClock[mover] : (control?.initial ?? null);
        if (before !== null) {
          const seconds = before - clock + (control?.increment ?? 0);
          if (seconds >= 0) {
            times.push({ ply: node.ply, mover, seconds });
          }
        }
        lastClock[mover] = clock;
      } else {
        lastClock[mover] = null;
      }
      seen[mover] = true;
    }
    node = node.children[0] ?? null;
  }
  return times;
}

/**
 * The remaining clock after each mainline move, one point per side per
 * clocked move (visualization ideas #10's second half). Unclocked moves
 * simply leave no point — the lines bridge the gap.
 */
export function remainingClocks(tree: GameTree): ClockPoint[] {
  const points: ClockPoint[] = [];
  let node: GameNode | null = tree.root;
  while (node !== null) {
    if (node.ply > 0 && node.clock !== null && node.clock !== undefined) {
      points.push({ ply: node.ply, mover: node.ply % 2 === 1 ? 'w' : 'b', remaining: node.clock });
    }
    node = node.children[0] ?? null;
  }
  return points;
}
