import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";
import { decrement } from "./actions/decrement";
import { increment } from "./actions/increment";
import { incrementByAmount } from "./actions/incrementByAmount";
import { websocketMiddleware } from "./connectivity/middlewares/websocketMiddleware";

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { connectivityReducer } from "./connectivity/connectivityReducer";
import { roomReducer } from "./rooms";

const counterSlice = createSlice({
    name: "counter",
    initialState: {
        value: 0,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(increment, (state) => {
                state.value += 1;
            })
            .addCase(decrement, (state) => {
                state.value -= 1;
            })
            .addCase(incrementByAmount, (state, action) => {
                state.value += action.payload.amount;
            });
    },
    selectors: {
        selectCount: (state) => state.value,
    },
});

export const { selectCount } = counterSlice.selectors;

const rootReducer = combineReducers({
    counter: counterSlice.reducer,
    connectivity: connectivityReducer,
    rooms: roomReducer,
});

export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(websocketMiddleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
