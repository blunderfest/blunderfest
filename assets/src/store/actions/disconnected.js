import { createAction } from "@reduxjs/toolkit";

export const disconnected = createAction("connectivity/disconnected", () => ({
  meta: {
    remote: true,
  },
  payload: {},
}));
