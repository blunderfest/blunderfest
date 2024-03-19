import { Container, Grid } from "@blunderfest/design-system/styled-system/jsx";
import { ColorSchemeToggle } from "./ColorSchemeToggle";
import { Layout } from "./Layout";
import { Square } from "./Square";
import { useBoard } from "./store/board";
import { incrementBy, useAppDispatch, useAppSelector } from "./store/store";

export function App() {
  const { squares } = useBoard();
  const state = useAppSelector((state) => state.counter.count);
  const dispatch = useAppDispatch();

  return (
    <Layout left="Left" right="Right" toolbar={<ColorSchemeToggle />}>
      <button onClick={() => dispatch(incrementBy(5))}>The chessboard {state}</button>
      <Container>
        <Grid columns={8} gap={0}>
          {squares.flatMap((square) => (
            <Square key={square.file + square.rank} {...square} />
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}
