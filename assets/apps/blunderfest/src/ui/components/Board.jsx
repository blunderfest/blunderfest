import { Grid } from "@blunderfest/design-system/styled-system/jsx";
import { useBoard } from "@blunderfest/store";
import { Square } from ".";

export function Board() {
  const board = useBoard();

  return (
    <Grid columns={8} gap={0}>
      {board.squares.flatMap((square) => (
        <Square key={square.squareIndex} {...square} />
      ))}
    </Grid>
  );
}
