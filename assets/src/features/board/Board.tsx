import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Square } from "./Square";
import { selectSquares } from "./boardSlice";
import { useKey } from "react-use";
import { flipBoard } from "@/store/actions";
import { DndContext } from "@dnd-kit/core";

export function Board() {
  const dispatch = useAppDispatch();

  useKey(
    (event) => event.key.toLocaleLowerCase() === "f",
    () => dispatch(flipBoard())
  );

  const squares = useAppSelector(selectSquares);

  return (
    <DndContext>
      <div className="grid w-2/5 grid-cols-8 grid-rows-8">
        {squares.map((square) => (
          <Square key={square.squareIndex} squareIndex={square.squareIndex}></Square>
        ))}
      </div>
    </DndContext>
  );
}
