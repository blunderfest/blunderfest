import { css } from "design-system";
import "design-system/styled-system/styles.css";
import { useState } from "react";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Square } from "./Square";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1>Vite + React</h1>
      <div
        className={css({
          backgroundColor: "green.dark.1",
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
      <Checkbox />
      <Button />
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
