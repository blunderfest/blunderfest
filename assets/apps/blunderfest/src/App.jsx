import { css } from "@blunderfest/design-system/styled-system/css";

import "@blunderfest/design-system/styled-system/styles.css";
import { useState } from "react";
import { Square } from "./Square";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1>Vite + React</h1>
      <div
        className={css({
          backgroundColor: "blue.dark.12",
          fontFamily: "monospace",
        })}
      >
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <Square />
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
