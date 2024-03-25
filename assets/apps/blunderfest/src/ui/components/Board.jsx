import { Grid } from "@blunderfest/design-system/styled-system/jsx";
import { useAppSelector } from "@blunderfest/store";
import { DndContext } from "@dnd-kit/core";
import { Square } from ".";

export function Board() {
  const board = useAppSelector((state) => state.board);

  return (
    <DndContext
      onDragEnd={(e) => {
        if (e.over?.data.current.squareIndex === e.active.data.current.squareIndex) {
          console.log("skip end", e);
        } else {
          console.log("end", e);
        }
      }}
      onDragCancel={(e) => console.log("cancel", e)}>
      <Grid columns={8} gap={0}>
        {board.squares.flatMap((square) => (
          <Square key={square.squareIndex} {...square} />
        ))}
      </Grid>
    </DndContext>
  );
}
