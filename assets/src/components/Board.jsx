import { move } from "@/store/actions/move";
import { selectCurrentVariation } from "@/store/slices/gameSlice";
import { selectCurrentGame } from "@/store/slices/roomSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { DndContext } from "@dnd-kit/core";
import { Square } from "./Square";

export function Board() {
  const squares = useAppSelector((state) => state.board.squares);
  const currentGame = useAppSelector(selectCurrentGame);
  const currentVariation = useAppSelector(selectCurrentVariation);

  const dispatch = useAppDispatch();

  return (
    <DndContext
      onDragEnd={(e) => {
        if (e.over?.data.current?.squareIndex === e.active.data.current?.squareIndex) {
          console.log("skip end", e);
        } else {
          dispatch(
            move(currentGame, {
              from: e.active.data.current.squareIndex,
              to: e.over?.data.current.squareIndex,
              variationPath: currentVariation,
            })
          );
        }
      }}
      onDragCancel={(e) => console.log("cancel", e)}>
      <div className="grid w-fit grid-cols-8 gap-0">
        {squares.flatMap((square) => (
          <Square key={square.squareIndex} square={square} />
        ))}
      </div>
    </DndContext>
  );
}
