import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Slice, createSlice } from "./slice";

export interface Store extends Slice {
    foo: string;
    setFoo: (input: string) => void;
}

export const useStore = create<Store>()(
    immer((set, get, store) => ({
        foo: "",
        setFoo: (input) => {
            set((state) => {
                state.foo = input;
            });
        },
        ...createSlice(set, get, store),
    }))
);
