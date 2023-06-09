import { create, useStore as useZustandStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";
import { countStore } from "./stores/countStore";
import { channelStore } from "./stores/channelStore";
import { withLenses } from "@dhmk/zustand-lens";

type StoreType = {
    count: typeof countStore;
    channel: typeof channelStore;
};

const storeCreator = create<StoreType>();
export const store = storeCreator(devtools(immer(withLenses({ count: countStore, channel: channelStore }))));

export function useStore(): StoreType;
export function useStore<T>(selector: (state: StoreType) => T, equals?: (a: T, b: T) => boolean): T;
export function useStore<T>(selector?: (state: StoreType) => T, equals?: (a: T, b: T) => boolean) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return useZustandStore(store, selector!, equals);
}
