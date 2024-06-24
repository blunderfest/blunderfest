import { Presence, Socket } from "phoenix";
import snakecaseKeys from "snakecase-keys";
import camelcaseKeys from "camelcase-keys";
import { disconnected, joined, left } from "@/store/actions";

const socket = new Socket("/socket", { params: { token: window["userToken"] } });
const channel = socket.channel("room:" + window["roomCode"], {});
const presence = new Presence(channel);

function pushToServer(action, userId) {
  if (action.type.includes("/") && action.meta.source === userId) {
    const payload = snakecaseKeys(action["payload"] ?? {}, {
      shouldRecurse: () => true,
    });

    channel.push(action.type, payload);
  }
}

function mapPresence(factory, key, presence) {
  return factory(key.toLocaleUpperCase(), camelcaseKeys(presence));
}

/**
 * @param {import("@reduxjs/toolkit").Dispatch} dispatch
 */
export function setupSocket(dispatch) {
  presence.onJoin((key, _currentPresence, newPresence) => {
    const payloads = newPresence.metas.map((meta) => mapPresence(joined, key, meta));

    payloads.forEach(dispatch);
  });

  presence.onLeave((key, _currentPresence, newPresence) => {
    const payloads = newPresence.metas.map((meta) => mapPresence(left, key, meta));

    payloads.forEach(dispatch);
  });

  socket.onClose(() => {
    dispatch(disconnected());
  });

  channel.onMessage = (event, payload, _ref) => {
    const action = {
      type: event,
      payload,
    };

    dispatch(
      camelcaseKeys(action, {
        deep: true,
      })
    );

    return payload;
  };

  return { socket, channel, pushToServer };
}
