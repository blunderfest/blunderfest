import { convertKeysToCamelCase, convertKeysToSnakeCase } from "@/lib/keyconverter";
import { disconnected } from "@/store/actions";
import { Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { Socket } from "phoenix";

export function createSocket(dispatch: Dispatch) {
  const socket = new Socket("/socket", { params: { token: window.userToken } });
  const channel = socket.channel("room:" + window.roomCode, {});

  socket.onClose(() => {
    dispatch(disconnected());
  });

  channel.onMessage = (event, originalPayload) => {
    const { meta, ...payload } = originalPayload ?? {};

    const action = {
      type: event,
      meta: meta,
      payload: payload.payload ?? payload,
    };

    const message = convertKeysToCamelCase(action);
    dispatch(message as UnknownAction);

    return originalPayload;
  };

  return {
    socket: {
      connect: () => {
        if (socket.connectionState() === "closed") {
          socket.connect();
        }
      },
    },
    channel: {
      join: (timeout?: number) => {
        if (channel.state === "joined") {
          return {
            receive: () => {},
          };
        }

        return channel.join(timeout);
      },
      push: (event: string, payload: object, timeout?: number) =>
        channel.push(event, convertKeysToSnakeCase(payload) as object, timeout),
    },
  };
}
