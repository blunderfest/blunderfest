import reactLogo from "assets/react.svg";

import { colors } from "@stylexjs/open-props/lib/colors.stylex";
import * as stylex from "@stylexjs/stylex";

import { useDispatch, useSelector } from "react-redux";
import { decrement } from "./actions/decrement";
import { increment } from "./actions/increment";
import { incrementByAmount } from "./actions/incrementByAmount";
import { connect } from "./connectivity/actions/connect";
import { disconnect } from "./connectivity/actions/disconnect";
import { join } from "./connectivity/actions/join";
import { leave } from "./connectivity/actions/leave";
import { selectCount } from "./store";

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

const user_id = document
  .querySelector("meta[name='user_id']")
  .getAttribute("content");
const room_code = document
  .querySelector("meta[name='room_code']")
  .getAttribute("content");

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
      <button onClick={() => dispatch(connect())}>Connect</button>
      <button onClick={() => dispatch(disconnect())}>Disconnect</button>
      <button onClick={() => dispatch(join(user_id, room_code))}>Join</button>
      <button onClick={() => dispatch(leave(room_code))}>Leave</button>
      <h1>Vite + React</h1>
      <div className="card">
        count is {count}
        <button onClick={() => dispatch(increment(room_code))}>+</button>
        <button onClick={() => dispatch(incrementByAmount(room_code, 5))}>
          + 5
        </button>
        <button onClick={() => dispatch(decrement(room_code))}>-</button>
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
