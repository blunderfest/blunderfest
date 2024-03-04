import reactLogo from "assets/react.svg";

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

import { noMargin } from "reset.css";
import { sprinkles } from "sprinkles.css";
import { container } from "./styles.css.ts";

const roomCode = document
  .querySelector("meta[name='room_code']")
  .getAttribute("content");

function App() {
  const count = useSelector(selectCount);
  const dispatch = useDispatch();

  const online = useSelector(selectOnline);
  const rooms = useSelector(selectRooms);
  const userId = useSelector(selectUserId);

  return (
    <>
      <div
        className={sprinkles({
          color: "blue-100",
        })}
      >
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
        <p className={container}>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className={noMargin}>
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
