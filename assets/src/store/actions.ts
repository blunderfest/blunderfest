import { Meta, Room } from "@/types";
import { createAction } from "@reduxjs/toolkit";

export const connect = createAction("connect");

export const connected = createAction("connected", (userId: string, room: Room) => ({
  payload: {
    userId: userId,
    room: room,
  },
}));

export const disconnected = createAction("disconnected");

export const presenceState = createAction(
  "presence_state",
  (
    presences: Record<
      string,
      {
        metas: Meta[];
      }
    >
  ) => ({
    payload: presences,
  })
);

export const presenceDiff = createAction(
  "presence_diff",
  (
    joins: Record<
      string,
      {
        metas: Meta[];
      }
    >,
    leaves: Record<
      string,
      {
        metas: Meta[];
      }
    >
  ) => ({
    payload: {
      joins,
      leaves,
    },
  })
);

export const flipBoard = createAction("flip_board");
