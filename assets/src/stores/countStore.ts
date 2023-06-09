import { Lens, lens } from "@dhmk/zustand-lens";

type CountStoreState = {
    count: number;
    increment: () => void;
};

const state: Lens<CountStoreState> = set => ({
    count: 0,
    increment: () => set(state => ({ count: state.count + 1 })),
});

export const countStore = lens(state);
