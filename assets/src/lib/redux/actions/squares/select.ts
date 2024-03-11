import { createAction } from "@reduxjs/toolkit";

export const select = createAction("room/square/select", (file: number, rank: number) => ({
    payload: { file, rank },
}));
