import { RecipeVariantProps, cva } from "@blunderfest/styled-system/css";

const square = cva({
    base: {
        aspectRatio: "square",
    },
    variants: {
        color: {
            dark: {
                backgroundColor: "square.dark",
            },
            light: {
                backgroundColor: "square.light",
            },
        },
    },
});

export type SquareVariants = RecipeVariantProps<typeof square>;

export function Square(props: SquareVariants) {
    return <div className={square(props)}></div>;
}
