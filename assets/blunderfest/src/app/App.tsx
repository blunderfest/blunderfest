import { button, container, noMargin } from '@blunderfest/design-system';
import {
  connect,
  decrement,
  disconnect,
  increment,
  incrementByAmount,
  join,
  leave,
  selectCount,
  selectOnline,
  selectRooms,
  selectUserId,
  useAppDispatch,
  useAppSelector,
} from '@blunderfest/redux';

type Props = {
  roomCode: string;
};

export function App(props: Props) {
  const { roomCode } = props;
  const count = useAppSelector(selectCount);
  const dispatch = useAppDispatch();

  const online = useAppSelector(selectOnline);
  const rooms = useAppSelector(selectRooms);
  const userId = useAppSelector(selectUserId);

  return (
    <>
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
        <button
          className={button}
          onClick={() => dispatch(increment(roomCode))}
        >
          +
        </button>
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
