import { Container } from "@blunderfest/design-system/styled-system/jsx";
import { Board, ColorSchemeToggle } from "@blunderfest/ui/components";
import { Layout } from "@blunderfest/ui/layouts";

export function App() {
  return (
    <Layout left="Left" right="Right" toolbar={<ColorSchemeToggle />}>
      <Container>
        <Board />
      </Container>
    </Layout>
  );
}
