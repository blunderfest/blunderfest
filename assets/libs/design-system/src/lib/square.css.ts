import { recipe, RecipeVariants } from "@vanilla-extract/recipes";

export const square = recipe({
    base: {
        aspectRatio: "1 / 1",
    },
    variants: {
        color: {
            dark: {
                backgroundColor: "#000",
            },
            light: {
                backgroundColor: "#FFF",
            },
        },
    },
});

export type SquareVariants = RecipeVariants<typeof square>;
