import reactLogo from "assets/react.svg";

import { colors } from "@stylexjs/open-props/lib/colors.stylex";
import * as stylex from "@stylexjs/stylex";

import { connect, disconnect, join, leave } from "connectivity/actions/actions";
import {
  selectOnline,
  selectRooms,
  selectUserId,
} from "connectivity/connectivityReducer";
import { useDispatch, useSelector } from "react-redux";
import { decrement } from "./actions/decrement";
import { increment } from "./actions/increment";
import { incrementByAmount } from "./actions/incrementByAmount";
import { selectCount } from "./store";

const roomCode = document
  .querySelector("meta[name='room_code']")
  .getAttribute("content");

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

  const online = useSelector(selectOnline);
  const rooms = useSelector(selectRooms);
  const userId = useSelector(selectUserId);

  return (
    <>
      <div>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <button disabled={online} onClick={() => dispatch(connect())}>
        Connect
      </button>
      <button disabled={!online} onClick={() => dispatch(disconnect())}>
        Disconnect
      </button>
      <button
        disabled={!online || rooms.includes(roomCode)}
        onClick={() =>
          dispatch(
            join({
              userId: userId,
              roomCode: roomCode,
            })
          )
        }
      >
        Join
      </button>
      <button
        disabled={!online || !rooms.includes(roomCode)}
        onClick={() => dispatch(leave({ roomCode: roomCode }))}
      >
        Leave
      </button>
      <h1>Vite + React</h1>
      <div className="card">
        count is {count}
        <button onClick={() => dispatch(increment(roomCode))}>+</button>
        <button onClick={() => dispatch(incrementByAmount(roomCode, 5))}>
          + 5
        </button>
        <button onClick={() => dispatch(decrement(roomCode))}>-</button>
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
