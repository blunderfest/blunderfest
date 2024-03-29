import { Box, Container } from "design-system/jsx";
import { Trans, useTranslation } from "react-i18next";
import { Board } from "~/components/Board";
import { GameSelector } from "~/components/GameSelector";
import { Toolbar } from "~/components/Toolbar";
import { layoutRecipe } from "~/components/recipes/layout.recipe";

export function App() {
  const classes = layoutRecipe();

  const { t } = useTranslation();

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Toolbar />
      </Box>
      <Box className={classes.left}>
        <Trans i18nKey="description.part1">
          Edit <code>src/App.js</code> and save to reload.
        </Trans>
      </Box>
      <Box className={classes.main}>
        <Container>
          <Board />
        </Container>
      </Box>
      <Box className={classes.right}>
        <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
          {t("description.part2")}
        </a>
        <GameSelector />
      </Box>
    </Box>
  );
}
