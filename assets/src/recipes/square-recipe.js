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
            none: {},
            marked: {},
            highlighted: {}
        },
    },
    compoundVariants: [
        {
            selected: "highlighted",
            css: {
                filter: "brightness(150%)"
            },
        },
        {
            selected: "marked",
            css: {
                backgroundColor: "red.500"
            }
        }
    ],
});

export const Square = styled("div", square);
