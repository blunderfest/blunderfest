import { useMemo, useRef } from "react";
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
  const games = useAppSelector((state) => state.room.games);
  const activeGame = useAppSelector((state) => state.game.byId[state.room.activeGame]);

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

  const fen = activeGame ? activeGame.position.fen : undefined;
  const position = useMemo(() => {
    if (fen) {
      return parseFen(fen);
    }

    return undefined;
  }, [fen]);

  if (!position) {
    return <>Loading...</>;
  }

  console.log(fen, position);

  return (
    <main {...keyboardProps}>
      <HStack>
        <VStack
          className={css({
            backgroundColor: "slate.200",
          })}
        >
          <ConnectionStatus />
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
