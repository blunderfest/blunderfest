import { createAction } from '@reduxjs/toolkit';

export const increment = createAction('room/increment', (roomCode: string) => ({
  meta: {
    roomCode,
  },
  payload: {},
}));
