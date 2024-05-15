import { selectCurrentPosition } from "@/store/slices/boardSlice";
import { SquareIndex } from "@/types";
import { useEffect, useState } from "react";
import { Square } from "./Square";
import { useAppSelector } from "@/store/hooks";

export function Board() {
  const [flipped, setFlipped] = useState(false);

  const position = useAppSelector((state) => selectCurrentPosition(state));

  function flip(e: KeyboardEvent) {
    if (e.key === "f" || e.key === "F") {
      setFlipped((flipped) => !flipped);
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", flip);

    return () => window.removeEventListener("keydown", flip);
  }, []);

  const ranks = [...Array(8).keys()];
  const files = [...Array(8).keys()];

  const squareIndexes: SquareIndex[] = (flipped ? ranks : ranks.toReversed()).flatMap((rank) =>
    files.map((file) => (8 * rank + file) as SquareIndex)
  );
  const squares = squareIndexes.map((squareIndex) => ({
    squareIndex,
    piece: position?.pieces[squareIndex],
  }));

  return (
    <div className="lg:w-3xl grid w-fit grid-cols-8 gap-0">
      {squares.flatMap((square) => (
        <Square key={square.squareIndex} squareIndex={square.squareIndex} piece={square.piece?.symbol} />
      ))}
    </div>
  );
}
