import { RecipeVariants, recipe } from "@vanilla-extract/recipes";

export const button = recipe({
    base: {
        /* styles */
    },

    variants: {
        tone: {
            primary: {
                backgroundColor: "red",
            },
            neutral: {
                backgroundColor: "blue",
            },
            critical: {
                /* styles */
            },
        },
        variant: {
            soft: {
                /* styles */
            },
            ghost: {
                /* styles */
            },
            transparent: {
                /* styles */
            },
        },
    },
    defaultVariants: {
        tone: "primary",
        variant: "ghost",
    },
});

export type ButtonVariants = RecipeVariants<typeof button>;
