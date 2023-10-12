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
            simple: {},
            ctrl: {},
            alt: {},
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
            selected: "simple",
            css: {
                backgroundColor: "red.500"
            }
        },
        {
            selected: "ctrl",
            css: {
                backgroundColor: "green.500"
            }
        },
        {
            selected: "alt",
            css: {
                backgroundColor: "yellow.500"
            }
        }
    ],
});

export const Square = styled("div", square);
