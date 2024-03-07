/**
 * https://www.joshwcomeau.com/css/custom-css-reset/
 */

import { globalStyle, style } from "@vanilla-extract/css";
import Fonts from "open-props/src/props.fonts";
import { reset } from "./layers.css";

globalStyle("html", {
    "@layer": {
        [reset]: {
            MozTextSizeAdjust: "none",
            WebkitTextSizeAdjust: "none",
            textSizeAdjust: "none",
        },
    },
});

globalStyle("body", {
    "@layer": {
        [reset]: {
            lineHeight: Fonts["--font-lineheight-3"],
            WebkitFontSmoothing: "antialiased",
        },
    },
});

globalStyle("#root", {
    "@layer": {
        [reset]: {
            isolation: "isolate",
        },
    },
});

export const baseReset = style({
    "@layer": {
        [reset]: {
            boxSizing: "border-box",
            margin: 0,
            "::before": {
                boxSizing: "border-box",
            },
            "::after": {
                boxSizing: "border-box",
            },
        },
    },
});

const mediaDefaults = style({
    display: "block",
    maxWidth: "100%",
});

const removeBuiltInFormTypography = style({
    font: "inherit",
});

const avoidTextOverflows = style({
    overflowWrap: "break-word",
});

type Resets = Partial<Record<keyof JSX.IntrinsicElements, string>>;

export const elementResets: Resets = {
    img: mediaDefaults,
    picture: mediaDefaults,
    video: mediaDefaults,
    canvas: mediaDefaults,
    svg: mediaDefaults,
    input: removeBuiltInFormTypography,
    button: removeBuiltInFormTypography,
    textarea: removeBuiltInFormTypography,
    select: removeBuiltInFormTypography,
    p: avoidTextOverflows,
    h1: avoidTextOverflows,
    h2: avoidTextOverflows,
    h3: avoidTextOverflows,
    h4: avoidTextOverflows,
    h5: avoidTextOverflows,
    h6: avoidTextOverflows,
};

// globalStyle("*, *::before, *::after", {
//     "@layer": {
//         [reset]: {
//             boxSizing: "border-box",
//         },
//     },
// });

// globalStyle("html", {
//     "@layer": {
//         [reset]: {
//             MozTextSizeAdjust: "none",
//             WebkitTextSizeAdjust: "none",
//             textSizeAdjust: "none",
//         },
//     },
// });

// globalStyle("body, h1, h2, h3, h4, p, figure, blockquote, dl, dd", {
//     "@layer": {
//         [reset]: {
//             marginBlockEnd: 0,
//         },
//     },
// });

// globalStyle("ul[role='list'], ol[role='list']", {
//     "@layer": {
//         [reset]: {
//             listStyle: "none",
//         },
//     },
// });

// globalStyle("body", {
//     "@layer": {
//         [reset]: {
//             minHeight: "100vh",
//             lineHeight: Fonts["--font-lineheight-3"],
//         },
//     },
// });

// globalStyle("h1, h2, h3, h4, button, input, label", {
//     "@layer": {
//         [reset]: {
//             lineHeight: Fonts["--font-lineheight-0"],
//         },
//     },
// });

// globalStyle("h1, h2, h3, h4", {
//     "@layer": {
//         [reset]: {
//             textWrap: "balance",
//         },
//     },
// });

// globalStyle("a:not([class])", {
//     "@layer": {
//         [reset]: {
//             textDecorationSkipInk: "auto",
//             color: "currentColor",
//         },
//     },
// });

// globalStyle("img, picture", {
//     "@layer": {
//         [reset]: {
//             maxWidth: "100%",
//             display: "block",
//         },
//     },
// });

// globalStyle("input, button, textarea, select", {
//     "@layer": {
//         [reset]: {
//             font: "inherit",
//         },
//     },
// });

// globalStyle("textarea:not([rows])", {
//     "@layer": {
//         [reset]: {
//             minHeight: "10em",
//         },
//     },
// });

// globalStyle(":target", {
//     "@layer": {
//         [reset]: {
//             scrollMarginBlock: "5ex",
//         },
//     },
// });
