import { selectChannel } from "connectivity/actions/actions";

/**
 * @constant
 * @type {import ("redux").Middleware}
 */
export const websocketMiddleware = () => {
  return (next) => {
    return (action) => {
      const result = next(action);

      if (action.meta && action.meta.roomCode && !action.meta.remote) {
        const channel = selectChannel(action.meta.roomCode);

        if (channel) {
          channel.push(action.type, action.payload);
        }
      }

      return result;
    };
  };
};
