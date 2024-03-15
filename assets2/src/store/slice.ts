import { SliceCreator } from "./types";

export interface Slice {
    bar: string;
    setBar: (input: string) => void;
}

export const createSlice: SliceCreator<keyof Slice> = (set, get) => {
    return {
        bar: "",
        setBar: (input) => {
            const newValue = input + get().foo; // slice has access to the rest of the store
            set((state) => {
                state.bar = newValue;
            });
        },
    };
};
