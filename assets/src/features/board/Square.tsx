import { RecipeVariantProps, sva } from "@blunderfest/styled-system/css";
import { Box } from "@blunderfest/styled-system/jsx";
import { useSquareViewModel } from "./useSquareViewModel";

const square = sva({
    slots: ["root", "overlay"],
    base: {
        root: {
            aspectRatio: "square",
            position: "relative",
            outline: "none",
        },
        overlay: {
            position: "absolute",
            top: "0",
            left: "0",
            bottom: "0",
            right: "0",
        },
    },
    variants: {
        color: {
            dark: {
                root: {
                    backgroundColor: "square.dark",
                },
            },
            light: {
                root: {
                    backgroundColor: "square.light",
                },
            },
        },
        selected: {
            true: {
                root: {
                    borderWidth: "thick",
                    borderStyle: "solid",
                    borderColor: {
                        _dark: "blue.dark.8",
                        _light: "blue.light.8",
                    },
                },
            },
        },
        focussed: {
            true: {
                root: {
                    borderWidth: "thick",
                    borderStyle: "solid",
                    borderColor: {
                        _dark: "blue.dark.8",
                        _light: "blue.light.8",
                    },
                },
            },
        },
        marked: {
            true: {
                overlay: {
                    borderWidth: "thick",
                    borderStyle: "solid",
                    borderColor: {
                        _dark: "green.dark.9",
                        _light: "green.light.9  ",
                    },
                    borderRadius: "full",
                },
            },
        },
    },
});

export type SquareVariants = { rank: number; file: number } & RecipeVariantProps<typeof square>;

export function Square(props: SquareVariants) {
    const { ariaProps, isFocused } = useSquareViewModel(props.file, props.rank);
    const classes = square({ ...props, focussed: isFocused });

    return (
        <Box {...ariaProps} className={classes.root} tabIndex={0} data-rank={props.rank} data-file={props.file}>
            <Box className={classes.overlay} tabIndex={-1}></Box>
        </Box>
    );
}
