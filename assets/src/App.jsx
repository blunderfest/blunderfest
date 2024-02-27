import reactLogo from "./assets/react.svg";

import { colors } from "@stylexjs/open-props/lib/colors.stylex";
import * as stylex from "@stylexjs/stylex";

import { useDispatch, useSelector } from "react-redux";
import { decrement, increment, incrementByAmount, selectCount } from "./store";
import "./user_socket";

const styles = stylex.create({
  base: {
    fontSize: 16,
    lineHeight: 1.5,
    color: "rgb(60,60,60)",
  },
  highlighted: {
    color: colors.pink3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "black",
  },
});

function App() {
  const count = useSelector(selectCount);
  const dispatch = useDispatch();

  return (
    <>
      <div>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        count is {count}
        <button onClick={() => dispatch(increment())}>+</button>
        <button onClick={() => dispatch(incrementByAmount(5))}>+ 5</button>
        <button onClick={() => dispatch(decrement())}>-</button>
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
