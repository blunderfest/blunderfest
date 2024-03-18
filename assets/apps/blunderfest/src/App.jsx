import { Container, Grid } from "@blunderfest/design-system/styled-system/jsx";
import { ColorSchemeToggle } from "./ColorSchemeToggle";
import { Layout } from "./Layout";
import { Square } from "./Square";

const ranks = Array.from({ length: 8 }, (_, rank) => 7 - rank);
const files = Array.from({ length: 8 }, (_, file) => file);

const squareIndices = ranks.flatMap((rank) => files.map((file) => rank * 8 + file));

export function App() {
  return (
    <Layout left="Left" right="Right" toolbar={<ColorSchemeToggle />}>
      <Container>
        <Grid columns={8} gap={0}>
          {squareIndices.flatMap((squareIndex) => (
            <Square key={squareIndex} squareIndex={squareIndex} />
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}
