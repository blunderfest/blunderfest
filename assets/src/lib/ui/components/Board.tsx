import { grid } from "@blunderfest/styled-system/patterns";
import { Square } from "./Square";

const ranks = [...Array(8).keys()].reverse();
const files = [...Array(8).keys()].reverse();

const squares = ranks.flatMap((rank) =>
    files.map((file) => {
        const index = rank * 8 + file;
        const color = rank % 2 === file % 2 ? "light" : "dark";

        return {
            index,
            color,
        } as const;
    })
);

export function Board() {
    return (
        <div
            className={grid({
                aspectRatio: "square",
                gap: "0",
                columns: 8,
                borderColor: {
                    _osLight: "gray.light.8",
                    _osDark: "gray.dark.8"
                },
                borderStyle: "solid",
                height: "2xl"
            })}>
            {squares.map((square) => (
                <Square key={square.index} color={square.color} />
            ))}
        </div>
    );
}
