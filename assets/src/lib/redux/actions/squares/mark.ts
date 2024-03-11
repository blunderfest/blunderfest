import { createAction } from "@reduxjs/toolkit";

export const mark = createAction("room/square/mark", (file: number, rank: number) => ({
    payload: { file, rank },
}));
