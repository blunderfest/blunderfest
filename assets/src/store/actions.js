import { createAction } from "@reduxjs/toolkit";

export const connect = createAction("room/connect", () => ({
  meta: {
    source: "server",
  },
  payload: {},
}));

export const connected = createAction(
  "room/connected",
  /**
   * @param {string} userId
   * @param {Room} room
   */
  (userId, room) => ({
    meta: {
      source: "server",
    },
    payload: {
      userId: userId,
      room: room,
    },
  })
);

export const disconnected = createAction("room/disconnected", () => ({
  meta: {
    source: "server",
  },
  payload: {},
}));

export const joined = createAction(
  "room/joined",
  /**
   * @param {string} userId
   * @param {Meta} meta
   */
  (userId, meta) => ({
    meta: {
      source: "server",
    },
    payload: {
      userId,
      meta,
    },
  })
);

export const left = createAction(
  "room/left",
  /**
   * @param {string} userId
   * @param {Meta} meta
   */
  (userId, meta) => ({
    meta: {
      source: "server",
    },
    payload: {
      userId,
      meta,
    },
  })
);

export const increment = createAction("counter/increment");
export const decrement = createAction("counter/decrement");
export const incrementByAmount = createAction(
  "counter/incrementByAmount",
  /**
   * @param {number} amount
   */
  (amount) => ({
    payload: {
      amount: amount,
    },
  })
);
