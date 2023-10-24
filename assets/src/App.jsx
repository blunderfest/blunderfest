import { useKeyboard } from "react-aria";
import { css } from "styled-system/css";
import { Container, HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { useAppDispatch, useAppSelector } from "./store";
import { reset } from "./store/board";
import { switchGame } from "./store/room/actions";

function App() {
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        dispatch(reset());
      }
    },
  });

  const games = useAppSelector((state) => state.game.games);
  const activeGame = useAppSelector((state) => state.room.activeGame);

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
          {Object.keys(games).map((game, index) => (
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
