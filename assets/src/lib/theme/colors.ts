import {
    blue,
    blueDark,
    gray,
    grayDark,
    green,
    greenDark,
    orange,
    orangeDark,
    slate,
    slateDark,
    tomato,
    tomatoDark,
    yellow,
    yellowDark,
} from "@radix-ui/colors";
import { convert } from ".";

export const colors = {
    current: { value: "currentColor" },
    black: { value: "#000" },
    white: { value: "#fff" },
    transparent: { value: "rgb(0 0 0 / 0)" },
    blue: {
        light: convert(blue, "blue"),
        dark: convert(blueDark, "blue"),
    },
    gray: {
        light: convert(gray, "gray"),
        dark: convert(grayDark, "gray"),
    },
    green: {
        light: convert(green, "green"),
        dark: convert(greenDark, "green"),
    },
    orange: {
        light: convert(orange, "orange"),
        dark: convert(orangeDark, "orange"),
    },
    red: {
        light: convert(tomato, "tomato"),
        dark: convert(tomatoDark, "tomato"),
    },
    slate: {
        light: convert(slate, "slate"),
        dark: convert(slateDark, "slate"),
    },
    yellow: {
        light: convert(yellow, "yellow"),
        dark: convert(yellowDark, "yellow"),
    },
};
