import { vars } from "./theme.css";

export const unresponsiveProps = {
    minBlockSize: ["100vh"],
} as const;

export const colorProps = {
    background: {
        primary: vars.color.blue,
        neutral: vars.color.blue,
    },
} as const;

export const responsiveProps = {
    margin: vars.size,
} as const;
