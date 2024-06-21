import { Socket } from "phoenix";
import snakecaseKeys from "snakecase-keys";
import camelcaseKeys from "camelcase-keys";
import { connect, connected } from "@/store/actions";

const socket = new Socket("/socket", { params: { token: window["userToken"] } });
const channel = socket.channel("room:" + window["roomCode"], {});

function withSource(action, userId) {
  if (!("meta" in action) || !("source" in action.meta)) {
    action = {
      ...action,
      meta: {
        ...action.meta,
        source: userId,
      },
    };
  }

  return action;
}

/**
 * @type {import("@reduxjs/toolkit").Middleware<{}, import("@/store").RootState, import("@/store").AppDispatch>}
 */
export const socketMiddleware = (api) => {
  channel.onMessage = (event, payload, _ref) => {
    const action = withSource(
      {
        type: event,
        payload,
      },
      "server"
    );

    api.dispatch(
      camelcaseKeys(action, {
        deep: true,
      })
    );

    return payload;
  };

  return (next) => (action) => {
    if (connect.match(action)) {
      if (socket.connectionState() === "closed") {
        socket.connect();
      }

      if (channel.state === "closed" || channel.state === "errored") {
        channel.join().receive("ok", (response) => {
          next(connected(response.user_id));
        });
      }
    } else {
      const userId = api.getState().connectivity.userId;
      const actionWithSource = withSource(action, userId);
      const result = next(actionWithSource);

      if (actionWithSource.meta.source === userId) {
        const payload = snakecaseKeys(actionWithSource["payload"] ?? {}, {
          shouldRecurse: () => true,
        });

        channel.push(actionWithSource.type, payload);
      }

      return result;
    }
  };
};
