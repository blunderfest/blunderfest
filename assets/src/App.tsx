import { useState } from "react";
import { Room } from "./features/room/Room";
import { useAppSelector } from "./store/hooks";
import { Button } from "./components/Button";
import { ColorSchemeSwitcher } from "./components/ColorSchemeSwitcher";

export function App() {
  const [count, setCount] = useState(0);
  const userId = useAppSelector((state) => state.connectivity.userId);

  return (
    <div className="h-screen w-screen bg-background text-text antialiased">
      <ColorSchemeSwitcher />
      <h1 className="text-lg font-bold text-red-600">{userId}</h1>
      <div className="card flex gap-5">
        <Button size="lg" color="secondary" onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </Button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <Room />
    </div>
  );
}
