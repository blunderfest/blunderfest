import { create, useStore as useZustandStore } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { withLenses } from "@dhmk/zustand-lens";

import { channelStore } from "./stores/channelStore";
import { countStore } from "./stores/countStore";

// https://amitd.co/code/typescript/recursively-deep-merging-objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deepMerge = <T extends Record<string, any>>(target: T, ...sources: T[]): T => {
    if (!sources.length) {
        return target;
    }

    Object.entries(sources.shift() ?? []).forEach(([key, value]) => {
        if (value) {
            if (!target[key]) {
                Object.assign(target, { [key]: {} });
            }

            if (value.constructor === Object || (value.constructor === Array && value.find(v => v.constructor === Object))) {
                deepMerge(target[key], value);
            } else if (value.constructor === Array) {
                Object.assign(target, {
                    [key]: value.find(v => v.constructor === Array)
                        ? target[key].concat(value)
                        : [...new Set([...target[key], ...value])],
                });
            } else {
                Object.assign(target, { [key]: value });
            }
        }
    });

    return target;
};

export type StoreType = {
    count: typeof countStore;
    channel: typeof channelStore;
};

const storeCreator = create<StoreType>();
export const store = storeCreator(
    immer(
        persist(
            devtools(
                withLenses(() => ({
                    count: countStore,
                    channel: channelStore,
                })),
            ),
            {
                name: "store",
                merge: (persistedState, currentState) => deepMerge(currentState, persistedState as StoreType),
                partialize: state => {
                    const persisted: Omit<StoreType, "channel"> = { count: state.count };

                    return persisted;
                },
            },
        ),
    ),
);

export function useStore<T>(selector: (state: StoreType) => T, equals?: (a: T, b: T) => boolean): T;
export function useStore<T>(selector?: (state: StoreType) => T, equals?: (a: T, b: T) => boolean) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return useZustandStore(store, selector!, equals);
}
