import { useObservable } from "@blunderfest/hooks/useObservable";
import { filter, scan } from "rxjs";
import { keyboard$ } from "./keyboard";

export function useBoard() {
  const flipped = useObservable(
    keyboard$.pipe(
      filter((e) => e.key === "f" || e.key === "F"),
      scan((state) => !state, false)
    )
  );

  const ranks = Array.from({ length: 8 }, (_, rank) => (flipped ? rank : 7 - rank));
  const files = Array.from({ length: 8 }, (_, file) => (flipped ? 7 - file : file));

  return {
    squares: ranks.flatMap((rank) =>
      files.map((file) => ({
        squareIndex: rank * 8 + file,
        rank: rank + 1,
        file: String.fromCharCode(64 + file),
      }))
    ),
  };
}
