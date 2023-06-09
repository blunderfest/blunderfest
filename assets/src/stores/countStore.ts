import { StateCreator } from "zustand";

export type CountStoreState = {
    count: number;
};

export const createCountStore: StateCreator<CountStoreState> = (set, get, api) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
});
