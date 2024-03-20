import { useObservableState } from "observable-hooks";
import { filter, scan } from "rxjs";
import { keyboard$ } from "./keyboard";

const flipping$ = keyboard$.pipe(
  filter((e) => e.key === "f" || e.key === "F"),
  scan((state) => !state, false)
);

export function useBoard() {
  const flipped = useObservableState(flipping$);

  const ranks = Array.from({ length: 8 }, (_, rank) => (flipped ? rank : 7 - rank));
  const files = Array.from({ length: 8 }, (_, file) => (flipped ? 7 - file : file));

  return {
    squares: ranks.flatMap((rank) =>
      files.map((file) => ({
        squareIndex: rank * 8 + file,
        rank: rank,
        file: file,
      }))
    ),
  };
}
