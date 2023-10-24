import { useRef } from "react";
import { useKeyboard } from "react-aria";
import { useClickAway } from "react-use";
import { css } from "styled-system/css";
import { Container, HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { parseFen } from "./features/parsers/parseFen";
import { useAppDispatch, useAppSelector } from "./store";
import { reset } from "./store/board";
import { switchGame } from "./store/room/actions";

function App() {
  const games = useAppSelector((state) => state.game.games);
  const dispatch = useAppDispatch();

  const ref = useRef(null);

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        dispatch(reset());
      }
    },
  });

  useClickAway(ref, (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    if (!target || !target.onclick || typeof target.onclick !== "function") {
      dispatch(reset());
    }
  });

  const activeGame = useAppSelector((state) => state.game.games[state.room.activeGame]);

  if (!activeGame) {
    return <>Loading...</>;
  }

  const position = parseFen(activeGame.positions[0].fen);

  return (
    <main {...keyboardProps}>
      <HStack>
        <VStack
          className={css({
            backgroundColor: "slate.200",
          })}
        >
          <ConnectionStatus />
          Active: {activeGame.id}
          {Object.keys(games).map((game, index) => (
            <button key={game} onClick={() => dispatch(switchGame(game))}>
              Game {index + 1}
            </button>
          ))}
        </VStack>
        <Container>
          <Board ref={ref} position={position} />
        </Container>
      </HStack>
    </main>
  );
}

export default App;
