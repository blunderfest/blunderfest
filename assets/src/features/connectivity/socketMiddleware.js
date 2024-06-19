import { Socket } from "phoenix";
import snakecaseKeys from "snakecase-keys";
import camelcaseKeys from "camelcase-keys";
import { connect, connected } from "@/store/actions";

const socket = new Socket("/socket", { params: { token: window["userToken"] } });
const channel = socket.channel("room:" + window["roomCode"], {});

function withSource(action) {
  if (!("meta" in action)) {
    action = { ...action, meta: {} };
  }

  if (!("source" in action.meta)) {
    action = {
      ...action,
      meta: {
        ...action.meta,
        source: window["userId"],
      },
    };
  }

  return action;
}

/**
 * @type {import("@reduxjs/toolkit").Middleware}
 */
export const socketMiddleware = (api) => {
  channel.onMessage = (event, payload, _ref) => {
    const action = {
      type: event,
      meta: {
        source: "server",
      },
      ...payload,
    };

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
        channel.join().receive("ok", (response) => (window["userId"] = response.user_id));
      }

      return next(connected());
    }

    const actionWithSource = withSource(action);
    const result = next(actionWithSource);

    if (actionWithSource.meta.source === window["userId"]) {
      const payload = snakecaseKeys(actionWithSource["payload"] ?? {}, {
        shouldRecurse: () => true,
      });

      channel.push(actionWithSource.type, payload);
    }

    return result;
  };
};
