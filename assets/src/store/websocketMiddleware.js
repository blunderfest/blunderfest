import { createListenerMiddleware } from "@reduxjs/toolkit";
import { Socket } from "phoenix";
import { connect } from "./actions/connect";
import { connected } from "./actions/connected";
import { disconnect } from "./actions/disconnect";
import { disconnected } from "./actions/disconnected";
import { joined } from "./actions/joined";
import { left } from "./actions/left";

function changeCase(item, replace) {
  if (Array.isArray(item)) {
    return item.map((el) => changeCase(el, replace));
  } else if (typeof item === "function" || item !== Object(item)) {
    return item;
  }
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [replace(key), changeCase(value, replace)]));
}

function camelize(item) {
  return changeCase(item, (key) => key.replace(/([-_][a-z])/gi, (c) => c.toUpperCase().replace(/[-_]/g, "")));
}

function snakelize(item) {
  return changeCase(item, (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));
}

const userToken = document.querySelector("meta[name='user_token']").getAttribute("content");
const roomCode = document.querySelector("meta[name='room_code']").getAttribute("content");

const socket = new Socket("/socket", { params: { token: userToken } });
const channels = {};

/**
 * @param {import("@reduxjs/toolkit").UnknownAction} action
 * @param {import("@reduxjs/toolkit").ListenerEffectAPI} listenerApi
 */
function effect(action, { dispatch }) {
  if (connect.match(action)) {
    socket.connect();

    dispatch(connected(userToken));

    const channel = socket.channel("room:" + roomCode);
    channels[roomCode] = channel;

    channel.onMessage = (event, payload) => {
      dispatch({
        type: event,
        payload: camelize(payload?.payload ?? {}),
        meta: {
          remote: true,
        },
      });

      return payload;
    };

    channel.onClose(() => {
      if (channel.state !== "leaving") {
        dispatch(left(roomCode));
        delete channels[roomCode];
      }
    });

    channel
      .join()
      .receive("ok", (game) => {
        const camelized = camelize(game);
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
  } else if (disconnect.match(action)) {
    socket.disconnect(() => {
      dispatch(disconnected());
    });
  } else if (!action?.meta?.remote) {
    const room = channels[roomCode];
    const payload = {
      meta: {
        room_code: roomCode,
      },
      payload: snakelize(action.payload),
    };
    room.push(action.type, payload);
  }
}

const websocketListener = createListenerMiddleware();
websocketListener.startListening({
  matcher: () => true,
  effect,
});

export const websocketMiddleware = websocketListener.middleware;
