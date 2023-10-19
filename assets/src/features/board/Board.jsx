import { Grid } from "styled-system/jsx/grid";
import { Square } from "./Square";
import { useBoard } from "./useBoard";

export function Board() {
  const { board, boardRef, squareRefs, keyboardProps } = useBoard();

  if (!board) {
    return <>Loading...</>;
  }

  return (
    <Grid
      role="grid"
      aria-colcount={8}
      aria-rowcount={8}
      ref={boardRef}
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
      {...keyboardProps}
    >
      {board.squares.map((square, index) => (
        <Square key={square.squareIndex} ref={(node) => (squareRefs.current[index] = node)} square={square} />
      ))}
    </Grid>
  );
}
