import { Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { Channel, Socket } from "phoenix";
import { connected, joined, left } from "../slices/connectivitySlice";

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

export function socketHandler(dispatch: Dispatch<UnknownAction>) {
  let socket: Socket;
  const channels: Record<string, Channel> = {};

  function connect(userToken: string, roomCode: string) {
    if (socket && socket.isConnected()) {
      return;
    }

    socket = new Socket("/socket", { params: { token: userToken } });

    socket.onOpen(() => {
      dispatch(connected());
    });
    socket.onOpen(() => {
      const room = addRoom(roomCode);
      join(room);
    });

    socket.connect();
  }

  function addRoom(roomCode: string) {
    const channel = socket.channel("room:" + roomCode);

    channel.onMessage = (event, payload) => {
      dispatch({
        type: event,
        payload: camelize(payload),
      });

      channel.onClose(() => {
        if (channel.state !== "leaving") {
          dispatch(left());
          delete channels[roomCode];
        }
      });

      return payload;
    };

    channels[roomCode] = channel;

    return channel;
  }

  function join(channel: Channel) {
    channel
      .join()
      .receive("ok", (game) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dispatch(joined(camelize(game) as any));
      })
      .receive("error", (resp) => {
        if (resp === "room_not_found") {
          socket.disconnect();
          location.href = "/";
        } else {
          console.error("channel.join", resp);
        }
      });
  }
  // isFSA(action) &&
  // typeof action.payload === "object" &&
  // action.payload &&
  // action &&
  // typeof action === "object" &&
  // "meta" in action &&
  // typeof action.meta === "object" &&
  // action.meta &&
  // "roomCode" in action.meta &&
  // typeof action.meta.roomCode === "string"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handle(action: any) {
    if (action?.payload && action?.meta?.roomCode) {
      const room = channels[action.meta.roomCode];
      room.push(action.type, snakelize(action.payload) as object);
    }
  }

  return {
    connect,
    handle,
  };
}
