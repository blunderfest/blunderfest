import { recipe, RecipeVariants } from "@vanilla-extract/recipes";
import AspectRatio from "open-props/src/props.aspects";
import { CustomMedia } from "open-props/src/props.media";

export const square = recipe({
    base: {
        aspectRatio: AspectRatio["--ratio-square"],
    },
    variants: {
        color: {
            dark: {
                "@media": {
                    [CustomMedia["--OSdark"]]: {
                        backgroundColor: "#000",
                    },
                    [CustomMedia["--OSlight"]]: {
                        backgroundColor: "#CCC",
                    },
                },
            },
            light: {
                "@media": {
                    [CustomMedia["--OSdark"]]: {
                        backgroundColor: "#CCC",
                    },
                    [CustomMedia["--OSlight"]]: {
                        backgroundColor: "#EEE",
                    },
                },
            },
        },
    },
});

export type SquareVariants = RecipeVariants<typeof square>;
