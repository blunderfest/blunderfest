import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import React from "react";
import * as ReactDOM from "react-dom/client";

import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { brown, yellow } from "@mui/material/colors";

import { App } from "./App.js";

const roomCode = document.querySelector("meta[name='room-code']")?.getAttribute("content") ?? "";

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: brown,
        secondary: yellow,
        background: {
            default: "#1b1716",
        },
    },
});

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = document.getElementById("root")!;
ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App roomCode={roomCode} />
        </ThemeProvider>
    </React.StrictMode>,
);
