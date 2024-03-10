import { RecipeVariantProps, cva } from "@blunderfest/styled-system/css";

const square = cva({
    base: {
        aspectRatio: "square",
        position: "relative",
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
        selected: {
            true: {
                // boxShadow: "inset 0 0 0 4px red",
                backgroundColor: "blue.dark.6",
            },
        },
        marked: {
            true: {
                _after: {
                    content: "' '",
                    position: "absolute",
                    top: "1",
                    left: "1",
                    right: "1",
                    bottom: "1",
                    borderStyle: "solid",
                    borderWidth: "0.5em",
                    borderColor: "square.marked",
                    borderRadius: "full",
                },
            },
        },
    },
});

export type SquareVariants = RecipeVariantProps<typeof square>;

export function Square(props: SquareVariants) {
    return <div className={square(props)}></div>;
}
