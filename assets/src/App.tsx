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
    <div className="flex w-screen flex-wrap gap-2 lg:flex-nowrap">
      <main className="w-full lg:order-2 lg:w-[50%]">
        <Board />
      </main>

      <aside className="w-full md:w-[50%] lg:order-1 lg:w-[25%]">
        <LanguageSwitcher />,
        <ConnectionStatus />
        <ColorSchemeToggle />
      </aside>

      <aside className="w-full md:w-[50%] lg:order-3 lg:w-[25%]">
        <h2>{t("room.online_users")}</h2>
        <ul>
          {Object.keys(users).map((userId) => (
            <li key={userId} className={clsx({ "font-bold": userId === currentUser })}>
              {userId} ({users[userId].length})
            </li>
          ))}
        </ul>
        <GameSelector />
      </aside>
    </div>
  );
}
