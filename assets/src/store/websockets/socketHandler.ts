import { connected, disconnected, joined, left } from "@/actions/joined";
import { Game } from "@/types/Piece";
import { Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { Channel, Socket } from "phoenix";

function changeCase(item: unknown, replace: (key: string) => string): unknown {
  if (Array.isArray(item)) {
    return item.map((el: unknown) => changeCase(el, replace));
  } else if (typeof item === "function" || item !== Object(item)) {
    return item;
  }
  return Object.fromEntries(
    Object.entries(item as Record<string, unknown>).map(([key, value]: [string, unknown]) => [
      replace(key),
      changeCase(value, replace),
    ])
  );
}

function camelize(item: unknown): unknown {
  return changeCase(item, (key) => key.replace(/([-_][a-z])/gi, (c) => c.toUpperCase().replace(/[-_]/g, "")));
}

function snakelize(item: unknown): unknown {
  return changeCase(item, (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));
}

type JoinedResponse = {
  games: string[];
  activeGame: string;
  gamesByCode: Record<string, Game>;
};

export function socketHandler(dispatch: Dispatch<UnknownAction>) {
  let socket: Socket;
  const channels: Record<string, Channel> = {};

  function connect(userToken: string, roomCode: string) {
    if (socket && socket.isConnected()) {
      return;
    }

    socket = new Socket("/socket", { params: { token: userToken } });

    socket.onOpen(() => {
      dispatch(connected(userToken));
    });

    socket.onOpen(() => {
      const channel = socket.channel("room:" + roomCode);

      channel.onMessage = (event, payload) => {
        dispatch({
          type: event,
          payload: camelize(payload),
        });

        channel.onClose(() => {
          if (channel.state !== "leaving") {
            dispatch(left(roomCode));
            delete channels[roomCode];
          }
        });

        return payload;
      };

      channels[roomCode] = channel;

      channel
        .join()
        .receive("ok", (game) => {
          const camelized = camelize(game) as JoinedResponse;
          dispatch(joined(roomCode, camelized.games, camelized.gamesByCode, camelized.activeGame));
        })
        .receive("error", (resp) => {
          if (resp === "room_not_found") {
            disconnect();
            location.href = "/";
          } else {
            console.error("channel.join", resp);
          }
        });
    });

    socket.connect();
  }

  function disconnect() {
    socket.disconnect(() => {
      dispatch(disconnected());
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handle(action: any) {
    if (action?.payload && action?.meta?.roomCode) {
      const room = channels[action.meta.roomCode];
      room.push(action.type, snakelize(action.payload) as object);
    }
  }

  return {
    connect,
    disconnect,
    handle,
  };
}
