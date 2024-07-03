import { Room } from "./features/room/Room";
import { useAppSelector } from "./store/hooks";
import { ColorSchemeSwitcher } from "./components/ColorSchemeSwitcher";
import { Board } from "./features/board/Board";

export function App() {
  const userId = useAppSelector((state) => state.connectivity.userId);

  return (
    <div className="h-screen w-screen bg-background text-text antialiased">
      <div className="flex w-screen justify-end bg-black/5 dark:bg-white/10">
        <ColorSchemeSwitcher />
      </div>
      <h1 className="text-lg font-bold text-red-600">{userId}</h1>
      <Room />
      <Board gameCode="some_game" />
    </div>
  );
}
