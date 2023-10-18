import { useEffect } from "react";

import { Container, HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { deselect, switchGame } from "./features/games/gamesSlice";
import { useAppDispatch, useAppSelector } from "./store";

function App() {
  useEffect(() => {
    const disableContextMenu = (/** @type {MouseEvent} */ e) => e.preventDefault();
    const deselectAll = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Escape") {
        dispatch(deselect());
      }
    };

    document.addEventListener("contextmenu", disableContextMenu);
    document.addEventListener("keydown", deselectAll);

    return () => {
      document.removeEventListener("contextmenu", disableContextMenu);
      document.removeEventListener("keydown", deselectAll);
    };
  });

  const games = useAppSelector((state) => state.games.allIds);
  const activeGame = useAppSelector((state) => state.games.activeGame);

  const dispatch = useAppDispatch();

  return (
    <main>
      <HStack>
        <VStack>
          <ConnectionStatus />
          Active: {activeGame}
          {games.map((game, index) => (
            <button key={game} onClick={() => dispatch(switchGame(game))}>
              Game {index + 1}
            </button>
          ))}
        </VStack>
        <Container>
          <Board />
        </Container>
      </HStack>
    </main>
  );
}

export default App;
