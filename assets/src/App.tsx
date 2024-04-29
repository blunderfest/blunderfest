import { ColorSchemeToggle } from "@/features/colorScheme/ColorSchemeToggle";
import { ConnectionStatus } from "@/features/connectivity/ConnectionStatus";
import { Board } from "@/features/games/Board";
import { GameSelector } from "@/features/games/GameSelector";
import { LanguageSwitcher } from "@/features/i18n/LanguateSwitcher";

export function App() {
  return (
    <div className="layout-sm lg:layout-lg md:layout-md grid grow bg-surface-1 text-surface-1">
      <header className="flex h-fit flex-row justify-end [grid-area:header]">
        <LanguageSwitcher />,
        <ConnectionStatus />
        <ColorSchemeToggle />
      </header>
      <aside className="[grid-area:left-sidebar]">
        Edit <code>src/App.js</code> and save to reload.
      </aside>
      <aside className="[grid-area:right-sidebar]">
        <GameSelector />
      </aside>
      <div className="[grid-area:main-content]">
        <Board />
      </div>
    </div>
  );
}
