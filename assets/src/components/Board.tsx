import { DndContext } from "@dnd-kit/core";
import { Grid } from "styled-system/jsx";
import { useAppSelector } from "~/store/store";
import { Square } from "./Square";

export function Board() {
  const squares = useAppSelector((state) => state.board.squares);

  if (!squares) {
    return null;
  }

  return (
    <DndContext
      onDragEnd={(e) => {
        if (e.over?.data.current?.squareIndex === e.active.data.current?.squareIndex) {
          console.log("skip end", e);
        } else {
          console.log("end", e);
        }
      }}
      onDragCancel={(e) => console.log("cancel", e)}>
      <Grid columns={8} gap={0}>
        {squares.flatMap((square) => (
          <Square key={square.squareIndex} square={square} />
        ))}
      </Grid>
    </DndContext>
  );
}
