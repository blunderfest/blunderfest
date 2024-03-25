import { useObservableState } from "observable-hooks";
import { filter, scan } from "rxjs";
import { keyboard$ } from "./keyboard";

const flipping$ = keyboard$.pipe(
  filter((e) => e.key === "f" || e.key === "F"),
  scan((state) => !state, false)
);

/**
 * @param {number} file
 * @param {number} rank
 * @returns {"k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P" | null}
 */
function determinePiece(file, rank) {
  if (rank === 0) {
    switch (file) {
      case 0:
      case 7: {
        return "R";
      }
      case 1:
      case 6: {
        return "N";
      }
      case 2:
      case 5: {
        return "B";
      }
      case 3: {
        return "Q";
      }
      case 4: {
        return "K";
      }
    }

    return null;
  } else if (rank === 1) {
    return "P";
  } else if (rank === 6) {
    return "p";
  } else if (rank === 7) {
    switch (file) {
      case 0:
      case 7: {
        return "r";
      }
      case 1:
      case 6: {
        return "n";
      }
      case 2:
      case 5: {
        return "b";
      }
      case 3: {
        return "q";
      }
      case 4: {
        return "k";
      }
    }
    return null;
  }
  return null;
}

export function useBoard() {
  const flipped = useObservableState(flipping$);

  const files = Array.from({ length: 8 }, (_, file) => (flipped ? 7 - file : file));
  const ranks = Array.from({ length: 8 }, (_, rank) => (flipped ? rank : 7 - rank));

  return {
    squares: ranks.flatMap((rank) =>
      files.map((file) => ({
        squareIndex: rank * 8 + file,
        rank: rank,
        file: file,
        piece: determinePiece(file, rank),
      }))
    ),
  };
}
