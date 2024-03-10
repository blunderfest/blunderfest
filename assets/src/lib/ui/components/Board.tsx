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
                gap: "00",
                columns: 8,
                borderColor: {
                    _light: "gray.light.8",
                    _dark: "gray.dark.8",
                },
                borderStyle: "solid",
            })}>
            {squares.map((square) => (
                <Square
                    key={square.index}
                    color={square.color}
                    marked={square.index === 43 || square.index === 30}
                    selected={square.index === 43}
                />
            ))}
        </div>
    );
}
