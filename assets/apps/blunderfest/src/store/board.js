import { useLayoutEffect, useState } from "react";
import { filter, scan, startWith } from "rxjs";
import { useLandmark } from "./landmark";

export function useBoard() {
  const { ref, keyboard$ } = useLandmark();
  const [flipped, setFlipped] = useState(false);

  useLayoutEffect(() => {
    const subscription = keyboard$
      .pipe(
        filter((e) => e.key === "f" || e.key === "F"),
        scan((state) => !state, true),
        startWith(false)
      )
      .subscribe((flipped) => setFlipped(flipped));

    return () => subscription.unsubscribe();
  });

  return { ref, flipped };
}
