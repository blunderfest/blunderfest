import { useEffect } from "react";

import { useKeyboard } from "react-aria";
import { css } from "styled-system/css";
import { Container, HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { deselect, switchGame } from "./features/games/gamesSlice";
import { useAppDispatch, useAppSelector } from "./store";

function App() {
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        dispatch(deselect());
      }
    },
  });

  useEffect(() => {
    const disableContextMenu = (/** @type {MouseEvent} */ e) => e.preventDefault();
    document.addEventListener("contextmenu", disableContextMenu);

    return () => {
      document.removeEventListener("contextmenu", disableContextMenu);
    };
  });

  const games = useAppSelector((state) => state.games.allIds);
  const activeGame = useAppSelector((state) => state.games.activeGame);

  const dispatch = useAppDispatch();

  return (
    <main {...keyboardProps}>
      <HStack>
        <VStack
          className={css({
            backgroundColor: "slate.200",
          })}
        >
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
