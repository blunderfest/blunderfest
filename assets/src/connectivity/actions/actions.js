import { createAsyncThunk } from "@reduxjs/toolkit";
import { Socket } from "phoenix";

const socket = new Socket("/socket", { params: { token: window.userToken } });

/**
 * @constant
 * @type {Record<string, import ("phoenix").Channel>}
 */
const channels = {};

export const connect = createAsyncThunk("connect", () => {
  return new Promise((resolve, reject) => {
    socket.connect();
    socket.onOpen(() => resolve());
    socket.onError(() => reject());
  });
});

export const disconnect = createAsyncThunk("disconnect", () => {
  return new Promise((resolve) => {
    socket.disconnect();
    resolve();
  });
});

export const join = createAsyncThunk(
  "join",
  /**
   * @param {{
   *    userId: string,
   *    roomCode: string
   * }} params
   */
  (params, { dispatch }) => {
    const { userId, roomCode } = params;

    return new Promise((resolve, reject) => {
      const channel = socket.channel("room:" + roomCode, {
        user_id: userId,
      });

      channels[roomCode] = channel;

      channel
        .join()
        .receive("ok", () => resolve(params))
        .receive("error", (resp) =>
          reject({ message: "Unable to join", resp })
        );

      channel.onMessage = (event, payload) => {
        dispatch({
          type: event,
          payload,
          meta: {
            remote: true,
          },
        });

        return payload;
      };

      channel.onClose(() => {
        if (channel.state !== "leaving") {
          dispatch(leave(roomCode));
        }
      });

      channel.onError((reason) => reject(reason));
    });
  }
);

export const leave = createAsyncThunk(
  "leave",
  /**
   * @param {{
   *    roomCode: string
   * }} params
   */
  (params) => {
    return new Promise((resolve, reject) => {
      const channel = channels[params.roomCode];

      if (!channel || channel.state !== "joined") {
        reject();
      } else {
        if (channel.state === "joined") {
          channel.leave();
        }

        delete channels[params.roomCode];
        resolve(params);
      }
    });
  }
);

export const selectChannel =
  /**
   * @param {string} roomCode
   */
  (roomCode) => channels[roomCode];
