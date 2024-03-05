/**
 * https://www.joshwcomeau.com/css/custom-css-reset/
 */

import { globalStyle } from "@vanilla-extract/css";
import OpenProps from "open-props";
import { reset } from "./layers.css";

globalStyle("*, *::before, *::after", {
    "@layer": {
        [reset]: {
            boxSizing: "border-box",
        },
    },
});

globalStyle("*", {
    "@layer": {
        [reset]: {
            margin: 0,
        },
    },
});

globalStyle("body", {
    "@layer": {
        [reset]: {
            lineHeight: OpenProps.size5,
            WebkitFontSmoothing: "antialiased",
        },
    },
});

globalStyle("img, picture, video, canvas, svg", {
    "@layer": {
        [reset]: {
            display: "block",
            maxWidth: "100%",
        },
    },
});

globalStyle("input, button, textarea, select", {
    "@layer": {
        [reset]: {
            font: "inherit",
        },
    },
});

globalStyle("p, h1, h2, h3, h4, h5, h6", {
    "@layer": {
        [reset]: {
            overflowWrap: "break-word",
        },
    },
});
