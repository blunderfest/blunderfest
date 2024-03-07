import { container } from "@blunderfest/design-system";
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
} from "@blunderfest/redux";
import { Board, Button } from "@blunderfest/ui";

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
                }>
                Join
            </button>
            <button disabled={!online || !rooms.includes(roomCode)} onClick={() => dispatch(leave({ roomCode: roomCode }))}>
                Leave
            </button>
            <h1>Vite + React</h1>
            <a href="https://www.google.nl">Go to google</a>
            <div>
                count is {count}
                <Button onClick={() => dispatch(increment(roomCode))}>INCREMENT</Button>
                <Button tone="neutral" onClick={() => dispatch(incrementByAmount(roomCode, 5))}>
                    + 5
                </Button>
                <Button onClick={() => dispatch(decrement(roomCode))}>-</Button>
                <p className={container}>
                    Edit <code>src/App.jsx</code> and save to test HMR
                </p>
                <Board />
            </div>
            <p>Click on the Vite and React logos to learn more</p>
        </>
    );
}
