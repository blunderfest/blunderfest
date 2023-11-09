import { useKeyboard } from "react-aria";
import { css } from "styled-system/css";
import { HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { MoveListBox } from "./features/movelist/MoveListBox";
import { useAppDispatch, useAppSelector } from "./store";
import { resetPosition } from "./store/actions";

function App() {
  const activeGameId = useAppSelector((state) => state.room.activeGame);
  const activeGame = useAppSelector((state) => state.game.entities[activeGameId ?? ""]);
  const position = useAppSelector((state) => (activeGame ? state.position.entities[activeGame.currentPositionId] : undefined));

  const dispatch = useAppDispatch();

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Escape" && position?.position) {
        dispatch(resetPosition(position.position.id));
      }
    },
  });

  return (
    <main {...keyboardProps}>
      <HStack>
        <VStack
          className={css({
            backgroundColor: "surface.4",
          })}>
          <ConnectionStatus />
        </VStack>
        {activeGameId && position && <Board gameId={activeGameId} positionId={position.position.id} />}
        {activeGameId && position && <MoveListBox gameId={activeGameId} positionId={position.position.id} />}
      </HStack>
    </main>
  );
}

export default App;
