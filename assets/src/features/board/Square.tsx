import { useAppSelector } from "@/store/hooks";
import { Piece } from "./Piece";
import { useDroppable } from "@dnd-kit/core";
import { selectSquare } from "./boardSlice";
import { memo } from "react";
import { squareRecipe } from "./squareRecipe";

export const Square = memo((props: Readonly<{ squareIndex: number }>) => {
  const square = useAppSelector((state) => selectSquare(state, "some_game", props.squareIndex));

  const { isOver, setNodeRef } = useDroppable({
    id: String(props.squareIndex),
    data: {
      squareIndex: props.squareIndex,
    },
  });

  const styles = squareRecipe({
    color: square.color,
    highlighted: isOver,
  });

  return (
    <div ref={setNodeRef} className={styles.base()}>
      <div className={styles.highlighted()}></div>
      <div className={styles.selected()}></div>
      <div className={styles.piece()}>
        {square.piece && (
          <Piece
            data={{
              squareIndex: props.squareIndex,
            }}
            piece={square.piece}
          />
        )}
      </div>
    </div>
  );
});
