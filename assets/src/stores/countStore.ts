import { lens } from "@dhmk/zustand-lens";

type CountStoreState = {
    count: number;
    increment: () => void;
};

export const countStore = lens<CountStoreState>(set => ({
    count: 0,
    increment: () => set(state => ({ count: state.count + 1 })),
}));
