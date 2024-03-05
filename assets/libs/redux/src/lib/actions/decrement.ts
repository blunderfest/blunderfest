import { createAction } from '@reduxjs/toolkit';

export const decrement = createAction('room/decrement', (roomCode: string) => ({
  meta: {
    roomCode,
  },
  payload: {},
}));
