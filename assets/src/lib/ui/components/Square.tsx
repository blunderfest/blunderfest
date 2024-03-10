import { RecipeVariantProps, cva } from "@blunderfest/styled-system/css";
import { token } from "@blunderfest/styled-system/tokens";

console.log(token.var("colors.blue.light.6"));
console.log(token("colors.blue.light.6"));
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
        selected: {
            true: {
                position: "relative",
                boxShadow: "inset 0 0 0 4px red",

                _after: {
                    content: "' '",
                    position: "absolute",
                    top: "1",
                    left: "1",
                    right: "1",
                    bottom: "1",
                    borderStyle: "solid",
                    borderWidth: "4",
                    borderColor: "square.marked",
                    borderRadius: "round",
                },
            },
        },
    },
});

export type SquareVariants = RecipeVariantProps<typeof square>;

export function Square(props: SquareVariants) {
    return <div className={square(props)}></div>;
}
