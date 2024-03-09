import { defineTokens } from "@pandacss/dev";
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

import { Recursive, Token } from "@blunderfest/styled-system/types/composition";

const digits = RegExp(/\d+/);

function convert(from: Record<string, string>) {
    const result: Recursive<Token<string>> = {};

    for (const key in from) {
        const scale = Number(digits.exec(key)![0]);

        result[scale] = {
            value: from[key],
        };
    }

    return result;
}

export const colors = defineTokens.colors({
    blue: {
        light: convert(blue),
        dark: convert(blueDark),
    },
    gray: {
        light: convert(gray),
        dark: convert(grayDark),
    },
    green: {
        light: convert(green),
        dark: convert(greenDark),
    },
    orange: {
        light: convert(orange),
        dark: convert(orangeDark),
    },
    red: {
        light: convert(tomato),
        dark: convert(tomatoDark),
    },
    slate: {
        light: convert(slate),
        dark: convert(slateDark),
    },
    yellow: {
        light: convert(yellow),
        dark: convert(yellowDark),
    },
});
