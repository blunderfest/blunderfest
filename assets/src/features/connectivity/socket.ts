import { joins, leaves } from "@/store/slices/roomSlice";
import { Dispatch } from "@reduxjs/toolkit";
import camelcaseKeys from "camelcase-keys";
import { Channel, Presence, Socket } from "phoenix";
import snakecaseKeys from "snakecase-keys";

const socket = new Socket("/socket", { params: { token: window.config.userToken } });
const channels = new Map<string, Channel>();

function initializePresence(channel: Channel, dispatch: Dispatch) {
  const presence = new Presence(channel);

  presence.onJoin((key, currentPresence: PresenceType, newPresence: PresenceType) => {
    console.log("onJoin", key, currentPresence, newPresence);

    const payloads = newPresence.metas.map((meta) =>
      joins({
        userId: meta.user_id,
        phxRef: meta.phx_ref,
        onlineAt: Number(meta.online_at),
      })
    );

    payloads.forEach(dispatch);
  });

  presence.onLeave((key, currentPresence: PresenceType, newPresence: PresenceType) => {
    console.log("onLeave", key, currentPresence, newPresence);

    const payloads = newPresence.metas.map((meta) =>
      leaves({
        userId: meta.user_id,
        phxRef: meta.phx_ref,
        onlineAt: Number(meta.online_at),
      })
    );

    payloads.forEach(dispatch);
  });
}

type PresenceType = {
  metas: {
    user_id: string;
    phx_ref: string;
    online_at: string;
  }[];
};

export const userSocket = {
  connect: () => socket.connect(),
  disconnect: () => socket.disconnect(),
  joinAsync: (topic: string, dispatch: Dispatch) =>
    new Promise<void>((resolve, reject) => {
      const channel = socket.channel(topic);
      channel
        .join()
        .receive("ok", () => {
          channels.set(topic, channel);
          initializePresence(channel, dispatch);

          resolve();
        })
        .receive("error", (response) => {
          reject(new Error(response));
        });

      channel.onMessage = (event, payload) => {
        if (event.includes("/")) {
          const action = { type: event, ...payload };

          dispatch(
            camelcaseKeys(action, {
              deep: true,
            })
          );
        }

        return payload;
      };
    }),
  send: (topic: string, event: string, payload: Record<string, unknown>) => {
    const channel = channels.get(topic);

    if (channel) {
      channel.push(
        event,
        snakecaseKeys(payload, {
          shouldRecurse: () => true,
        })
      );
    }
  },
};
