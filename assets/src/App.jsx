import { useClickOutside } from "@mantine/hooks";
import { useState } from "react";
import { FocusScope, useKeyboard } from "react-aria";
import { css } from "styled-system/css";
import { HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { MoveListBox } from "./features/movelist/MoveListBox";
import { useAppDispatch, useAppSelector } from "./store";
import { resetPosition } from "./store/actions";

function App() {
  const [moveListBox, serMoveListBox] = useState(/** @type {HTMLDivElement | null} */ (null));
  const [vstack, serVstack] = useState(/** @type {HTMLDivElement | null} */ (null));

  const gameCode = useAppSelector((state) => state.room.activeGame);
  const game = useAppSelector((state) => state.game.entities[gameCode ?? ""]);

  const dispatch = useAppDispatch();

  useClickOutside(
    () => {
      if (game) {
        dispatch(resetPosition(game.currentPositionId));
      }
    },
    null,
    [moveListBox, vstack],
  );

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Escape" && game) {
        dispatch(resetPosition(game.currentPositionId));
      }
    },
  });

  if (!gameCode) {
    return <></>;
  }

  return (
    <main {...keyboardProps}>
      <HStack>
        <VStack
          ref={serVstack}
          className={css({
            backgroundColor: "surface.4",
          })}>
          <ConnectionStatus />
        </VStack>
        <FocusScope>
          <Board gameCode={gameCode} />
        </FocusScope>
        <MoveListBox ref={serMoveListBox} gameCode={gameCode} />
      </HStack>
    </main>
  );
}

export default App;
