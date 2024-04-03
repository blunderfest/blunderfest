import { Board } from "@/components/Board";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { GameSelector } from "@/components/GameSelector";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Trans, useTranslation } from "react-i18next";
import { tv } from "tailwind-variants";

const layoutRecipe = tv({
  slots: {
    root: "layout-sm lg:layout-lg md:layout-md bg-surface-1 text-surface-1 grid grow",
    header: "flex h-fit flex-row justify-end [grid-area:header]",
    left: "[grid-area:left-sidebar]",
    right: "[grid-area:right-sidebar] ",
    main: "[grid-area:main-content]",
  },
});

export function App() {
  const classes = layoutRecipe();

  const { t } = useTranslation();

  return (
    <div className={classes.root()}>
      <header className={classes.header()}>
        <LanguageSwitcher />,
        <ConnectionStatus />
        <ColorSchemeToggle />
      </header>
      <aside className={classes.left()}>
        <Trans i18nKey="description.part1">
          Edit <code>src/App.js</code> and save to reload.
        </Trans>
      </aside>
      <aside className={classes.right()}>
        <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
          {t("description.part2")}
        </a>
        <GameSelector />
      </aside>
      <div className={classes.main()}>
        <Board />
      </div>
    </div>
  );
}
