import { useEffect } from "react";

import { HStack } from "styled-system/jsx/hstack";
import { Board } from "./features/board/Board";
import { ConnectionStatus } from "./features/connectivity/Connection";

function App() {
  useEffect(() => {
    const disableContextMenu = (/** @type {MouseEvent} */ e) => e.preventDefault();
    document.addEventListener("contextmenu", disableContextMenu);

    return () => document.removeEventListener("contextmenu", disableContextMenu);
  });

  return (
    <HStack>
      <Board />
      <ConnectionStatus />
    </HStack>
  );
}

export default App;
