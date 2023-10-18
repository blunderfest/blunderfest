import { useEffect, useRef } from "react";

import { Container, HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { deselect, switchGame } from "./features/games/gamesSlice";
import { useAppDispatch, useAppSelector } from "./store";

function App() {
  const ref = useRef(null);

  useEffect(() => {
    const disableContextMenu = (/** @type {MouseEvent} */ e) => e.preventDefault();
    document.addEventListener("contextmenu", disableContextMenu);

    return () => document.removeEventListener("contextmenu", disableContextMenu);
  });

  const games = useAppSelector((state) => state.games.allIds);
  const activeGame = useAppSelector((state) => state.games.activeGame);

  const dispatch = useAppDispatch();

  return (
    <main>
      <HStack>
        <VStack
          ref={ref}
          onClick={(e) => {
            if (e.target === ref.current) {
              dispatch(deselect());
            }
          }}
          onTouchStart={(e) => {
            if (e.target === ref.current) {
              dispatch(deselect());
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              dispatch(deselect());
            }
          }}
        >
          <ConnectionStatus />
          Active: {activeGame}
          {games.map((game) => (
            <button key={game} onClick={() => dispatch(switchGame(game))}>
              {game}
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
