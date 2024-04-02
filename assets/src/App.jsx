import { Board } from "@/components/Board";
import { GameSelector } from "@/components/GameSelector";
import { Toolbar } from "@/components/Toolbar";
import { Trans, useTranslation } from "react-i18next";

export function App() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-row justify-end bg-red-50">
        <Toolbar />
      </header>

      <div className="flex flex-1 flex-col sm:flex-row">
        <main className="flex-1 bg-indigo-100">
          <Board />
        </main>

        <nav className="order-first bg-purple-200 sm:w-32">
          <Trans i18nKey="description.part1">
            Edit <code>src/App.js</code> and save to reload.
          </Trans>
        </nav>

        <aside className="bg-yellow-100 sm:w-32">
          <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
            {t("description.part2")}
          </a>
          <GameSelector />
        </aside>
      </div>
    </div>
  );
}
