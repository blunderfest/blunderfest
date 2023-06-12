import { create, useStore as useZustandStore } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { withLenses } from "@dhmk/zustand-lens";

import { deepMerge } from "./deep-merge";
import { channelStore } from "./stores/channelStore";
import { countStore } from "./stores/countStore";

type StoreType = {
    count: typeof countStore;
    channel: typeof channelStore;
};

const storeCreator = create<StoreType>();
export const store = storeCreator(
    immer(
        devtools(
            persist(
                withLenses(() => ({
                    count: countStore,
                    channel: channelStore,
                })),
                {
                    name: "Test",
                    merge: (persistedState, currentState) => deepMerge(currentState, persistedState as StoreType),
                    partialize: state => ({ count: state.count }),
                },
            ),
        ),
    ),
);

export function useStore(): StoreType;
export function useStore<T>(selector: (state: StoreType) => T, equals?: (a: T, b: T) => boolean): T;
export function useStore<T>(selector?: (state: StoreType) => T, equals?: (a: T, b: T) => boolean) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return useZustandStore(store, selector!, equals);
}
