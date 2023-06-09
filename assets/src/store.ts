import { create, useStore as useZustandStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";

type StoreType = {
    count: number;
    increase: () => void;
};

const storeCreator = create<StoreType>();
export const store = storeCreator(
    devtools(
        immer(set => ({
            count: 0,
            increase: () => set(state => ({ count: state.count + 1 })),
        })),
    ),
);

export function useStore(): StoreType;
export function useStore<T>(selector: (state: StoreType) => T, equals?: (a: T, b: T) => boolean): T;
export function useStore<T>(selector?: (state: StoreType) => T, equals?: (a: T, b: T) => boolean) {
    return useZustandStore(store, selector!, equals);
}
