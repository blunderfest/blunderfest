import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import React from "react";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import * as ReactDOM from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import { store } from "~/modules/store";

import { CssBaseline } from "@mui/material";
import { brown, yellow } from "@mui/material/colors";
import { Experimental_CssVarsProvider as CssVarsProvider, experimental_extendTheme as extendTheme } from "@mui/material/styles";

import { App } from "./App";
import { enSystem } from "./modules/common";

const roomCode = document.querySelector("meta[name='room-code']")?.getAttribute("content") ?? "";

const theme = extendTheme({
    colorSchemes: {
        dark: {
            palette: {
                mode: "dark",
                primary: brown,
                secondary: yellow,
                background: {
                    default: "#2e1d1a",
                },
                contrastThreshold: 4.5,
                board: {
                    light: "#D7DEE4",
                    dark: "#3869A0",
                },
            },
        },
    },
});

const root = document.getElementById("root");

if (root === null) {
    throw new Error("Root element not found");
}

i18n.use(initReactI18next)
    .use(LanguageDetector)
    .init({
        resources: {
            en: {
                system: enSystem,
            },
        },
        fallbackLng: "en",
        interpolation: {
            escapeValue: false,
        },
        debug: true,
        react: { useSuspense: false },
    });

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <Provider store={store}>
            <CssVarsProvider theme={theme} defaultMode="dark">
                <CssBaseline />
                <App roomCode={roomCode} />
            </CssVarsProvider>
        </Provider>
    </React.StrictMode>,
);
