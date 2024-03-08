import { createAction } from "@reduxjs/toolkit";

export const incrementByAmount = createAction("room/incrementByAmount", (roomCode: string, amount: number) => ({
    meta: {
        roomCode,
    },
    payload: {
        amount,
    },
}));
