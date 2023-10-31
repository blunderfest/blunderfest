import { useKeyboard } from "react-aria";
import { css } from "styled-system/css";
import { HStack, VStack } from "styled-system/jsx";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";
import { MoveListBox } from "./features/movelist/MoveListBox";
import { useAppDispatch, useAppSelector } from "./store";
import { reset } from "./store/positions";

// const Checkbox = () => {
//   const classes = checkbox({ size: "sm" });
//   return (
//     <label className={classes.root}>
//       <input type="checkbox" className={css({ srOnly: true })} />
//       <div className={classes.control} />
//       <span className={classes.label}>Checkbox Label</span>
//     </label>
//   );
// };

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
          })}
        >
          <ConnectionStatus />
        </VStack>
        {positionId && <Board positionId={positionId} />}
        {activeGame && positionId && <MoveListBox gameId={activeGame} positionId={positionId} />}
      </HStack>
    </main>
  );
}

export default App;
