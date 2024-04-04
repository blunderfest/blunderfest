import { Board } from "@/components/Board";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { GameSelector } from "@/components/GameSelector";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { tv } from "tailwind-variants";

const layoutRecipe = tv({
  slots: {
    root: "layout-sm lg:layout-lg md:layout-md grid grow bg-surface-1 text-surface-1",
    header: "flex h-fit flex-row justify-end [grid-area:header]",
    left: "[grid-area:left-sidebar]",
    right: "[grid-area:right-sidebar] ",
    main: "[grid-area:main-content]",
  },
});

export function App() {
  const classes = layoutRecipe();

  return (
    <div className={classes.root()}>
      <header className={classes.header()}>
        <LanguageSwitcher />,
        <ConnectionStatus />
        <ColorSchemeToggle />
      </header>
      <aside className={classes.left()}>
        Edit <code>src/App.js</code> and save to reload.
      </aside>
      <aside className={classes.right()}>
        <GameSelector />
      </aside>
      <div className={classes.main()}>
        <Board />
      </div>
    </div>
  );
}
