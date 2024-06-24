/**
 * @type {import("@reduxjs/toolkit").Middleware<{}, import("@/store").RootState, import("@reduxjs/toolkit").Dispatch>}
 */
export const appendUserIdMiddleware = (api) => {
  return (next) => (action) => {
    function withSource(action) {
      if (!action.type.includes("/")) {
        return action;
      }

      const userId = api.getState().connectivity.userId;

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

    return next(withSource(action));
  };
};
