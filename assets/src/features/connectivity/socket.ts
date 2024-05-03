import { Channel, Socket } from "phoenix";
import snakecaseKeys from "snakecase-keys";

const socket = new Socket("/socket", { params: { token: window.config.userToken } });
const channels: Record<string, Channel> = {};

export const userSocket = {
  connect: () => socket.connect(),
  disconnect: () => socket.disconnect(),
  joinAsync: (topic: string, onMessage: (type: string, payload: Record<string, unknown>) => void) =>
    new Promise<void>((resolve, reject) => {
      const channel = socket.channel(topic);
      channel
        .join()
        .receive("ok", () => {
          channels[topic] = channel;
          resolve();
        })
        .receive("error", (response) => {
          reject(new Error(response));
        });

      channel.onMessage = (event, payload) => {
        onMessage(event, payload);

        return payload;
      };
    }),
  send: (topic: string, event: string, payload: Record<string, unknown>) => {
    const channel = channels[topic];
    channel.push(
      event,
      snakecaseKeys(payload, {
        shouldRecurse: () => true,
      })
    );
  },
};
