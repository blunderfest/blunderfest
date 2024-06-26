import { UseSelector, useDispatch, useSelector } from "react-redux";
import { RootState, store } from ".";
import { UnknownAction } from "@reduxjs/toolkit";

export const useAppDispatch = () => {
  const dispatch = useDispatch();

  return function (action: UnknownAction) {
    const userId = store.getState().connectivity.userId;

    return dispatch({
      ...action,
      meta: {
        triggeredBy: userId,
        source: "local",
      },
    });
  };
};

export const useAppSelector: UseSelector<RootState> = useSelector;
