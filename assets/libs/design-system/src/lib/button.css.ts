import { recipe } from "@vanilla-extract/recipes";
import { sprinkles } from "./sprinkles.css";

export const button = recipe({
    base: sprinkles({
        background: {
            darkMode: "blue-100",
            lightMode: "gray-900",
        },
        borderWidth: "medium",
    }),
    variants: {
        background: {
            default: sprinkles({
                borderColor: {
                    darkMode: "green",
                    lightMode: "red",
                },
            }),
        },
    },
});
