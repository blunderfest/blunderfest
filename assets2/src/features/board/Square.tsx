import { RecipeVariant, sva } from "@blunderfest/styled-system/css";
import { Box } from "@blunderfest/styled-system/jsx";

const square = sva({
    slots: ["root", "overlay", "piece", "selected"],
    base: {
        root: {
            aspectRatio: "square",
            position: "relative",
            outline: "none",
        },
        overlay: {
            position: "absolute",
            top: "8px",
            left: "8px",
            bottom: "8px",
            right: "8px",
        },
        selected: {
            position: "absolute",
            top: "0",
            left: "0",
            bottom: "0",
            right: "0",
        },
        piece: {
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
                selected: {
                    borderWidth: "8px",
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
                selected: {
                    borderWidth: "8px",
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

export type SquareVariants = RecipeVariant<typeof square>;

export function Square(props: Readonly<SquareVariants>) {
    const classes = square(props);
    const rank = Math.random();
    const file = Math.random();

    return (
        <Box className={classes.root} tabIndex={0} data-rank={rank} data-file={file}>
            <Box className={classes.overlay} tabIndex={-1}></Box>
            <Box className={classes.selected} tabIndex={-1}></Box>

            <Box className={classes.piece}>
                {(file === 4 || file === 1) && rank === 0 && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 45 45"
                        width="100%"
                        height="100%"
                        pointerEvents="none"
                        style={{
                            cursor: "pointer",
                            pointerEvents: "none",
                        }}>
                        <g
                            pointerEvents="visible"
                            fill="none"
                            fillRule="evenodd"
                            stroke="#000"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5">
                            <path strokeLinejoin="miter" d="M22.5 11.63V6M20 8h5" />
                            <path
                                fill="#fff"
                                strokeLinecap="butt"
                                strokeLinejoin="miter"
                                d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
                            />
                            <path
                                fill="#fff"
                                d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"
                            />
                            <path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" />
                        </g>
                    </svg>
                )}
                {(file === 4 || file === 1) && rank === 7 && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 45 45"
                        width="100%"
                        height="100%"
                        pointerEvents="none"
                        style={{
                            cursor: "pointer",
                        }}>
                        <g
                            pointerEvents="visible"
                            style={{
                                fill: "none",
                                fillOpacity: 1,
                                fillRule: "evenodd",
                                stroke: "#000",
                                strokeWidth: 1.5,
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                                strokeMiterlimit: 4,
                                strokeDasharray: "none",
                                strokeOpacity: 1,
                            }}>
                            <path
                                d="M22.5 11.63V6"
                                style={{
                                    fill: "none",
                                    stroke: "#000",
                                    strokeLinejoin: "miter",
                                }}
                            />
                            <path
                                d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
                                style={{
                                    fill: "#000",
                                    fillOpacity: 1,
                                    strokeLinecap: "butt",
                                    strokeLinejoin: "miter",
                                }}
                            />
                            <path
                                d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"
                                style={{
                                    fill: "#000",
                                    stroke: "#000",
                                }}
                            />
                            <path
                                d="M20 8h5"
                                style={{
                                    fill: "none",
                                    stroke: "#000",
                                    strokeLinejoin: "miter",
                                }}
                            />
                            <path
                                d="M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5v2.1-2.1C20 18 10.85 14 6.97 19.85 4.5 25.5 13 29.5 13 29.5"
                                style={{
                                    fill: "none",
                                    stroke: "#fff",
                                }}
                            />
                            <path
                                d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0"
                                style={{
                                    fill: "none",
                                    stroke: "#fff",
                                }}
                            />
                        </g>
                    </svg>
                )}
            </Box>
        </Box>
    );
}
