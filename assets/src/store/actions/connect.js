import { createAction } from "@reduxjs/toolkit";

export const connect = createAction("connectivity/connect", () => ({
  meta: {
    remote: true,
  },
  payload: {},
}));
