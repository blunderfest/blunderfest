import { createListenerMiddleware, type PayloadAction } from "@reduxjs/toolkit";
import { changeLanguage as i18nextChangeLanguage } from "i18next";

import { createAppSlice } from "~/app/create-app-slice";
import { type Language } from "~/lib/i18n/resources";

type UserPreferencesSliceState = {
  language: Language;
};

const initialState: UserPreferencesSliceState = {
  language: "en",
};

export const userPreferencesSlice = createAppSlice({
  name: "user-preferences",
  initialState,
  reducers: (create) => ({
    changeLanguage: create.reducer((state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    }),
  }),
  selectors: {
    selectCurrentLanguage: (state) => state.language,
  },
});

export const { changeLanguage } = userPreferencesSlice.actions;
export const { selectCurrentLanguage } = userPreferencesSlice.selectors;

export const synchronizeI18NextMiddleware = createListenerMiddleware();
synchronizeI18NextMiddleware.startListening({
  actionCreator: changeLanguage,
  effect: (action) => {
    i18nextChangeLanguage(action.payload);
  },
});
