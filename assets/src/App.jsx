import { useKeyboard } from "react-aria";
import { css } from "styled-system/css";
import { HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { MoveListBox } from "./features/movelist/MoveListBox";
import { useAppDispatch, useAppSelector } from "./store";
import { reset } from "./store/positionSlice";

function App() {
  const activeGame = useAppSelector((state) => state.room.activeGame);
  const positionId = useAppSelector((state) => (activeGame ? state.position.currentPositions[activeGame] : undefined));

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
            backgroundColor: "surface.4",
          })}>
          <ConnectionStatus />
        </VStack>
        {activeGame && positionId && <Board gameId={activeGame} positionId={positionId} />}
        {activeGame && positionId && <MoveListBox gameId={activeGame} positionId={positionId} />}
      </HStack>
    </main>
  );
}

export default App;
