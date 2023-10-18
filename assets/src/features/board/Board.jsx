import { useAppSelector } from "@/store";
import { Grid } from "styled-system/jsx/grid";
import { selectCurrentPosition } from "../games/gamesSlice";
import { Square } from "./Square";

export function Board() {
  const board = useAppSelector(selectCurrentPosition);

  if (!board) {
    return <>Loading...</>;
  }

  const selectedSquare = board.selectedSquare;

  return (
    <Grid
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
        <Square key={square.squareIndex} square={square} highlighted={selectedSquare === square.squareIndex} />
      ))}
    </Grid>
  );
}
