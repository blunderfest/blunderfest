import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentPosition } from "@/store/slices/boardSlice";
import { move } from "@/store/slices/gameSlice";
import { selectCurrentGame } from "@/store/slices/roomSlice";
import { SquareIndex } from "@/types";
import { DndContext } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { Square } from "./Square";

export function Board() {
  const [flipped, setFlipped] = useState(false);

  const position = useAppSelector((state) => selectCurrentPosition(state));
  const currentGame = useAppSelector((state) => selectCurrentGame(state));

  const dispatch = useAppDispatch();

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

  const squareIndexes: SquareIndex[] = (flipped ? ranks.reverse() : ranks).flatMap((rank) =>
    files.map((file) => (8 * rank + file) as SquareIndex)
  );
  const squares = squareIndexes.map((squareIndex) => ({
    squareIndex,
    piece: position?.pieces[squareIndex],
  }));

  return (
    <DndContext
      onDragEnd={(e) => {
        if (e.over?.data.current?.squareIndex === e.active.data.current?.squareIndex) {
          console.log("skip end", e);
        } else {
          dispatch(
            move({
              gameCode: currentGame,
              move: {
                from: e.active.data.current!.squareIndex,
                to: e.over!.data.current!.squareIndex,
                variationPath: [],
                promotion: undefined,
              },
            })
          );
        }
      }}
      onDragCancel={(e) => console.log("cancel", e)}>
      <div className="grid w-fit grid-cols-8 gap-0">
        {squares.flatMap((square) => (
          <Square key={square.squareIndex} squareIndex={square.squareIndex} piece={square.piece?.symbol} />
        ))}
      </div>
    </DndContext>
  );
}
