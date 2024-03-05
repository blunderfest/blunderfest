/**
 * https://piccalil.li/blog/a-more-modern-css-reset/
 */

import { globalStyle } from "@vanilla-extract/css";
import Fonts from "open-props/src/props.fonts";
import { reset } from "./layers.css";

globalStyle("*, *::before, *::after", {
    "@layer": {
        [reset]: {
            boxSizing: "border-box",
        },
    },
});

globalStyle("html", {
    "@layer": {
        [reset]: {
            MozTextSizeAdjust: "none",
            WebkitTextSizeAdjust: "none",
            textSizeAdjust: "none",
        },
    },
});

globalStyle("body, h1, h2, h3, h4, p, figure, blockquote, dl, dd", {
    "@layer": {
        [reset]: {
            marginBlockEnd: 0,
        },
    },
});

globalStyle("ul[role='list'], ol[role='list']", {
    "@layer": {
        [reset]: {
            listStyle: "none",
        },
    },
});

globalStyle("body", {
    "@layer": {
        [reset]: {
            minHeight: "100vh",
            lineHeight: Fonts["--font-lineheight-3"],
        },
    },
});

globalStyle("h1, h2, h3, h4, button, input, label", {
    "@layer": {
        [reset]: {
            lineHeight: Fonts["--font-lineheight-0"],
        },
    },
});

globalStyle("h1, h2, h3, h4", {
    "@layer": {
        [reset]: {
            textWrap: "balance",
        },
    },
});

globalStyle("a:not([class])", {
    "@layer": {
        [reset]: {
            textDecorationSkipInk: "auto",
            color: "currentColor",
        },
    },
});

globalStyle("img, picture", {
    "@layer": {
        [reset]: {
            maxWidth: "100%",
            display: "block",
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

globalStyle("textarea:not([rows])", {
    "@layer": {
        [reset]: {
            minHeight: "10em",
        },
    },
});

globalStyle(":target", {
    "@layer": {
        [reset]: {
            scrollMarginBlock: "5ex",
        },
    },
});
