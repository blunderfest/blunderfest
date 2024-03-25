import { Socket } from "phoenix";
import { Subject } from "rxjs";

/**
 * @type {Subject<string>}
 */
export const remoteMessages$ = new Subject();

export function useConnectivity(userToken, roomCode) {
  const socket = new Socket("/socket", { params: { token: userToken } });
  /**
   * @type {Record<string, import "phoenix".Channel>}
   */
  const join = () => {
    const channel = socket.channel("room:" + roomCode);
    channel
      .join()
      .receive("ok", (game) => {
        remoteMessages$.next(game);
      })
      .receive("error", (resp) => {
        if (resp === "room_not_found") {
          socket.disconnect();
          location.href = "/";
        } else {
          console.error("channel.join", resp);
          remoteMessages$.next(roomCode);
        }
      });

    channel.onMessage = (event, payload) => {
      remoteMessages$.next({
        type: event,
        payload,
      });
      return payload;
    };

    channel.onClose(() => {
      if (channel.state !== "leaving") {
        remoteMessages$.next("leaving");
      }
    });

    channel.onError(() => {
      remoteMessages$.next("left(roomCode)");
    });
  };
  const connect = () => {
    socket.connect();
    socket.onOpen(() => {
      remoteMessages$.next("connected()");
      join();
    });
    socket.onError((e) => {
      console.error("socket.onError", e);
      remoteMessages$.next("disconnected()");
    });
  };
  const disconnect = () => {
    socket.disconnect();
    remoteMessages$.next("disconnected()");
  };
  return {
    connect,
    disconnect,
  };
}
