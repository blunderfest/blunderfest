import { Board } from "@/components/Board";
import { Toolbar } from "@/components/Toolbar";
import { layoutRecipe } from "@/components/recipes/layout.recipe";
import { Box, Container } from "@design-system/jsx";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

const lngs = {
  en: { nativeName: "English" },
  nl: { nativeName: "Nederlands" },
} as const;

export function App() {
  const classes = layoutRecipe();

  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(0);

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Toolbar />
      </Box>
      <Box className={classes.left}>
        <>
          <Trans i18nKey="description.part1">
            Edit <code>src/App.js</code> and save to reload.
          </Trans>
          <div>
            {(["en", "nl"] as const).map((lng) => (
              <button
                key={lng}
                style={{ fontWeight: i18n.resolvedLanguage === lng ? "bold" : "normal" }}
                type="submit"
                onClick={() => {
                  i18n.changeLanguage(lng);
                  setCount(count + 1);
                }}>
                {lngs[lng].nativeName}
              </button>
            ))}
          </div>
        </>
      </Box>
      <Box className={classes.main}>
        <Container>
          <Board />
        </Container>
      </Box>
      <Box className={classes.right}>
        <>
          <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
            {t("description.part2")}
          </a>
          <p>
            <i>{t("counter", { count })}</i>
          </p>
        </>
      </Box>
    </Box>
  );
}
