import { create, useStore as useZustandStore } from "zustand";
import { immer } from "zustand/middleware/immer";

type StoreType = {
    count: number;
    increase: () => void;
};

export const store = create<StoreType>()(
    immer(set => ({
        count: 0,
        increase: () => set(state => ({ count: state.count + 1 })),
    })),
);

export function useStore(): StoreType;
export function useStore<T>(selector: (state: StoreType) => T, equals?: (a: T, b: T) => boolean): T;
export function useStore<T>(selector?: (state: StoreType) => T, equals?: (a: T, b: T) => boolean) {
    return useZustandStore(store, selector!, equals);
}
