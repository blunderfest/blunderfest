import { connect } from "connectivity/actions/connect";
import { connected } from "connectivity/actions/connected";
import { disconnect } from "connectivity/actions/disconnect";
import { disconnected } from "connectivity/actions/disconnected";
import { join } from "connectivity/actions/join";
import { joined } from "connectivity/actions/joined";
import { leave } from "connectivity/actions/leave";
import { left } from "connectivity/actions/left";
import { Socket } from "phoenix";

/**
 * @constant
 * @type {import ("redux").Middleware}
 */
export const websocketMiddleware = ({ dispatch, getState }) => {
  const socket = new Socket("/socket", { params: { token: window.userToken } });

  /**
   * @constant
   * @type {Record<string, import ("phoenix").Channel>}
   */
  const channels = {};

  return (next) => {
    return (action) => {
      const result = next(action);

      if (connect.match(action)) {
        socket.connect();

        dispatch(connected());
      }

      if (disconnect.match(action)) {
        socket.disconnect();
        dispatch(disconnected());
      }

      if (join.match(action)) {
        const { roomCode, userId } = action.payload;
        const channel = socket.channel("room:" + roomCode, {
          user_id: userId,
        });

        channels[roomCode] = channel;

        channel
          .join()
          .receive("ok", (resp) => {
            console.log("Joined successfully", resp);
            dispatch(joined(userId, roomCode));
          })
          .receive("error", (resp) => {
            console.log("Unable to join", resp);
          });

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
          dispatch(left(roomCode));
        });

        channel.onError((reason) => {
          console.error("ERROR", reason);
        });

        dispatch(joined(userId, roomCode));
      }

      if (leave.match(action)) {
        const channel = channels[action.payload.roomCode];
        channel.leave();
        dispatch(left(action.payload.roomCode));
      }

      if (left.match(action)) {
        delete channels[action.payload.roomCode];
      }

      const online = getState().connectivity.online;
      console.log("ONLINE????", online);

      if (action.meta && action.meta.roomCode && !action.meta.remote) {
        const channel = channels[action.meta.roomCode];

        if (channel) {
          channel.push(action.type, action.payload);
        }
      }

      console.log("WEBSOCKET", action);
      return result;
    };
  };
};
