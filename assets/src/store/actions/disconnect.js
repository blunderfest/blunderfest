import { createAction } from "@reduxjs/toolkit";

export const disconnect = createAction("connectivity/disconnect", () => ({
  meta: {
    remote: true,
  },
  payload: {},
}));
