import { useAppDispatch, useAppSelector } from "@/store";
import { useClickAway } from "@uidotdev/usehooks";
import { Grid } from "styled-system/jsx/grid";
import { Square } from "./Square";
import { deselect } from "./boardSlice";

export function Board() {
  const board = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  const ref = useClickAway(() => {
    dispatch(deselect());
  });

  return (
    <Grid
      ref={ref}
      columns={8}
      rowGap={0}
      columnGap={0}
      height={{
        base: "auto",
        lg: "100vh",
      }}
      width={{
        base: "100vw",
        lg: "auto",
      }}
      aspectRatio="square"
      backgroundColor="slate.900"
    >
      {board.squares.map((square) => (
        <Square key={square.squareIndex} square={square} />
      ))}
    </Grid>
  );
}
