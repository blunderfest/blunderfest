import { useState } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";

import { colorsHSL } from "@stylexjs/open-props/lib/colorsHSL.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  base: {
    fontSize: 16,
    lineHeight: 1.5,
    color: "rgb(60,60,60)",
  },
  highlighted: {
    color: `hsl(${colorsHSL.choco10})`,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "black",
  },
});

function App() {
  const [count, setCount] = useState(1);

  return (
    <>
      <div>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p {...stylex.props(styles.base, styles.highlighted)}>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
