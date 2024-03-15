// export const remoteMessages$ = new Subject<PayloadAction<unknown, string>>();

// const userId = document?.querySelector("meta[name='user_id']")?.getAttribute("content");
// const roomCode = document?.querySelector("meta[name='room_code']")?.getAttribute("content");

// remoteMessages$.subscribe((message) => store.dispatch(message));

export const useSocket = () => {
    // const socket = new Socket("/socket", { params: { token: undefined } });
    // const channels: Record<string, Channel> = {};
    // const join = () => {
    //     const channel = socket.channel("room:" + roomCode, {
    //         user_id: userId,
    //     });
    //     channels[roomCode] = channel;
    //     channel
    //         .join()
    //         .receive("ok", (game: GameState) => {
    //             remoteMessages$.next(joined(roomCode, userId, game.games, game.games_by_code));
    //         })
    //         .receive("error", (resp) => {
    //             console.error("channel.join", resp);
    //             remoteMessages$.next(left(roomCode));
    //         });
    //     channel.onMessage = (event, payload) => {
    //         remoteMessages$.next({
    //             type: event,
    //             payload,
    //         });
    //         return payload;
    //     };
    //     channel.onClose(() => {
    //         if (channel.state !== "leaving") {
    //             remoteMessages$.next(left(roomCode));
    //         }
    //     });
    //     channel.onError(() => {
    //         remoteMessages$.next(left(roomCode));
    //     });
    // };
    // const connect = () => {
    //     socket.connect();
    //     socket.onOpen(() => {
    //         remoteMessages$.next(connected());
    //         join();
    //     });
    //     socket.onError((e) => {
    //         console.error("socket.onError", e);
    //         remoteMessages$.next(disconnected());
    //     });
    // };
    // const disconnect = () => {
    //     socket.disconnect();
    //     remoteMessages$.next(disconnected());
    // };
    // return {
    //     connect,
    //     disconnect,
    // };
};
