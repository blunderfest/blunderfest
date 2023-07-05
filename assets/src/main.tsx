import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import React from "react";
import * as ReactDOM from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import { store } from "~/modules/store";

import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { brown, yellow } from "@mui/material/colors";

import { App } from "./App";
import { enSystem } from "./modules/common";

const roomCode = document.querySelector("meta[name='room-code']")?.getAttribute("content") ?? "";

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: brown,
        secondary: yellow,
        background: {
            default: "#2e1d1a",
        },
        contrastThreshold: 4.5,
    },
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: () => ({
                    backgroundColor: brown[900],
                }),
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: () => ({
                    backgroundImage: "none",
                }),
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
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <App roomCode={roomCode} />
            </ThemeProvider>
        </Provider>
    </React.StrictMode>,
);
