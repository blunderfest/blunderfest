/**
 * https://piccalil.li/blog/a-more-modern-css-reset/
 */

import { defineGlobalStyles } from "@pandacss/dev";

export const reset = defineGlobalStyles({
  "*, *::before, *::after": {
    boxSizing: "border-box",
  },
  html: {
    "-moz-text-size-adjust": "none",
    "-webkit-text-size-adjust": "none",
    textSizeAdjust: "none",
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif",
  },
  body: {
    margin: 0,
    lineHeight: 1.5,
    backgroundColor: "surface.background.1",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  "body, h1, h2, h3, h4, p, figure, blockquote, dl, dd": {
    marginBlockEnd: 0,
  },
  "ul[role='list'], ol[role='list']": {
    listStyle: "none",
  },
  "h1, h2, h3, h4, button, input, label": {
    lineHeight: 1.1,
  },
  "h1, h2, h3, h4": {
    textWrap: "balance",
  },
  "a:not([class])": {
    textDecorationSkipInk: "auto",
    color: "currentcolor",
  },
  "img, picture": {
    maxWidth: "100%",
    display: "block",
  },
  "input, button, textarea, select": {
    font: "inherit",
  },
  "textarea:not([rows])": {
    minHeight: "10em",
  },
  ":target": {
    scrollMarginBlock: "5ex",
  },
  "#root": {
    isolation: "isolate",
    marginBottom: "auto",
    flex: "1 auto",
  },
});
