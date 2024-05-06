import { ColorSchemeToggle } from "@/features/colorScheme/ColorSchemeToggle";
import { ConnectionStatus } from "@/features/connectivity/ConnectionStatus";
import { Board } from "@/features/games/Board";
import { GameSelector } from "@/features/games/GameSelector";
import { LanguageSwitcher } from "@/features/i18n/LanguateSwitcher";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "./store/hooks";
import { clsx } from "clsx";

export function App() {
  const { t } = useTranslation();
  const users = useAppSelector((state) => state.room.users);
  const currentUser = useAppSelector((state) => state.room.userId);

  return (
    <div className="layout-sm lg:layout-lg md:layout-md grid grow bg-surface-1 text-surface-1">
      <header className="flex h-fit flex-row justify-end [grid-area:header]">
        {window.config.userId}
        <LanguageSwitcher />,
        <ConnectionStatus />
        <ColorSchemeToggle />
      </header>
      <aside className="[grid-area:left-sidebar]">
        <h2>{t("room.online_users")}</h2>
        <ul>
          {Object.keys(users).map((userId) => (
            <li key={userId} className={clsx({ "font-bold": userId === currentUser })}>
              {userId} ({users[userId].length})
            </li>
          ))}
        </ul>
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
