import { convertKeysToCamelCase, convertKeysToSnakeCase } from "@/lib/keyconverter";
import { disconnected } from "@/store/actions";
import { Dispatch } from "@reduxjs/toolkit";
import { Socket } from "phoenix";

export function createSocket(dispatch: Dispatch) {
  const socket = new Socket("/socket", { params: { token: window.userToken } });
  const channel = socket.channel("room:" + window.roomCode, {});

  socket.onClose(() => {
    dispatch(disconnected());
  });

  channel.onMessage = (event, originalPayload, _ref) => {
    const { meta, ...payload } = originalPayload ?? {};

    const action = {
      type: event,
      meta: meta,
      payload: payload.payload ?? payload,
    };

    const message = convertKeysToCamelCase(action);
    dispatch(message);

    return originalPayload;
  };

  return {
    socket: {
      connect: (params?: any) => socket.connect(params),
    },
    channel: {
      join: (timeout?: number) => channel.join(timeout),
      push: (event: string, payload: object, timeout?: number) => channel.push(event, convertKeysToSnakeCase(payload), timeout),
    },
  };
}
