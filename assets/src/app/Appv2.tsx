// import { Board } from "@blunderfest/features/board";
// import {
//     connect,
//     decrement,
//     disconnect,
//     increment,
//     incrementByAmount,
//     join,
//     leave,
//     selectCount,
//     selectOnline,
//     selectRooms,
//     selectUserId,
//     useAppDispatch,
//     useAppSelector,
// } from "@blunderfest/redux";

// type Props = {
//     roomCode: string;
// };

// export function Appv2(props: Readonly<Props>) {
//     const { roomCode } = props;
//     const count = useAppSelector(selectCount);
//     const dispatch = useAppDispatch();

//     const online = useAppSelector(selectOnline);
//     const rooms = useAppSelector(selectRooms);
//     const userId = useAppSelector(selectUserId);

//     return (
//         <>
//             <button disabled={online} onClick={() => dispatch(connect())}>
//                 Connect
//             </button>
//             <button disabled={!online} onClick={() => dispatch(disconnect())}>
//                 Disconnect
//             </button>
//             <button
//                 disabled={!online || rooms.includes(roomCode)}
//                 onClick={() =>
//                     dispatch(
//                         join({
//                             userId: userId,
//                             roomCode: roomCode,
//                         })
//                     )
//                 }>
//                 Join
//             </button>
//             <button disabled={!online || !rooms.includes(roomCode)} onClick={() => dispatch(leave({ roomCode: roomCode }))}>
//                 Leave
//             </button>
//             <h1>Vite + React</h1>
//             <a href="https://www.google.nl">Go to google</a>
//             <div>
//                 count is {count}
//                 <button onClick={() => dispatch(increment(roomCode))}>INCREMENT</button>
//                 <button onClick={() => dispatch(incrementByAmount(roomCode, 5))}>+ 5</button>
//                 <button title="Some title" onClick={() => dispatch(decrement(roomCode))}>
//                     -
//                 </button>
//                 <p>
//                     Edit <code>src/App.jsx</code> and save to test HMR
//                 </p>
//             </div>
//             <div>
//                 <Board />
//             </div>
//             <p>Click on the Vite and React logos to learn more</p>
//         </>
//     );
// }
