import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

const square = cva({
    base: {
        aspectRatio: "square",
    },
    variants: {
        color: {
            dark: {
                backgroundColor: "darkSquare",
            },
            light: {
                backgroundColor: "lightSquare",
            },
        },
        selected: {
            true: {
            },
        },
    },
    compoundVariants: [
        {
            selected: true,
            css: {
                filter: "brightness(150%)"
            },
        },
    ],
});

export const Square = styled("div", square);
