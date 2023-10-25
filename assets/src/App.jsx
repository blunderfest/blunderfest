import { useKeyboard } from "react-aria";
import { css } from "styled-system/css";
import { Container, HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { useAppDispatch, useAppSelector } from "./store";
import { reset } from "./store/positions";
import { switchGame } from "./store/room/actions";

function App() {
  const games = useAppSelector((state) => state.room.games);
  const activeGame = useAppSelector((state) => state.room.activeGame);
  const positionId = useAppSelector((state) => (activeGame ? state.game.byId[activeGame].currentPositionId : undefined));

  const dispatch = useAppDispatch();

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Escape" && positionId) {
        dispatch(reset(positionId));
      }
    },
  });

  return (
    <main {...keyboardProps}>
      <HStack>
        <VStack
          className={css({
            backgroundColor: "slate.200",
          })}
        >
          <ConnectionStatus />
          {games.map((game, index) => (
            <button key={game} onClick={() => dispatch(switchGame(game))}>
              Game {index + 1} {activeGame === game ? "A" : ""}
            </button>
          ))}
        </VStack>
        <Container>{positionId && <Board positionId={positionId} />}</Container>
      </HStack>
    </main>
  );
}

export default App;
