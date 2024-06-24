import { createAction } from "@reduxjs/toolkit";

export const connect = createAction("connect");

export const connected = createAction(
  "connected",
  /**
   * @param {string} userId
   * @param {Room} room
   */
  (userId, room) => ({
    payload: {
      userId: userId,
      room: room,
    },
  })
);

export const disconnected = createAction("disconnected");

export const presenceState = createAction(
  "presence_state",
  /**
   * @param {Record<string, {
   *   metas: Meta[]
   * }>} presences
   */
  (presences) => ({
    payload: presences,
  })
);

export const presenceDiff = createAction(
  "presence_diff",
  /**
   * @param {Record<string, {
   *   metas: Meta[]
   * }>} joins
   * @param {Record<string, {
   *   metas: Meta[]
   * }>} leaves
   */
  (joins, leaves) => ({
    payload: {
      joins,
      leaves,
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
