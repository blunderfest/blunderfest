import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { boardReducer } from './features/board/boardSlice'

export const store = configureStore({
    reducer: {
        board: boardReducer
    },
})

/**
 * @type {() => typeof store.dispatch}
 */
export const useAppDispatch = useDispatch

/**
 * @type {import('react-redux').TypedUseSelectorHook<ReturnType<typeof store.getState>>}
 */
export const useAppSelector = useSelector
