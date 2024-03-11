import { Grid } from "@blunderfest/styled-system/jsx";
import { FocusScope } from "react-aria";
import { Square } from "./Square";
import { useBoardViewModel } from "./useBoardViewModel";

const ranks = [...Array(8).keys()].reverse();
const files = [...Array(8).keys()];

const squares = ranks.flatMap((rank) =>
    files.map((file) => {
        const color = rank % 2 === file % 2 ? "dark" : "light";

        return {
            rank,
            file,
            color,
        } as const;
    })
);

export function Board() {
    const { ref, ariaProps } = useBoardViewModel();

    return (
        <FocusScope restoreFocus>
            <Grid
                ref={ref}
                {...ariaProps}
                tabIndex={-1}
                aspectRatio="square"
                gap="0"
                columns={8}
                borderColor={{
                    _light: "gray.light.8",
                    _dark: "gray.dark.8",
                }}
                borderStyle="solid">
                {squares.map((square) => (
                    <Square
                        key={String(square.rank) + String(square.file)}
                        rank={square.rank}
                        file={square.file}
                        color={square.color}
                        marked={(square.file === 2 && square.rank === 4) || (square.file === 5 && square.rank === 6)}
                        selected={square.file === 2 && square.rank === 4}
                    />
                ))}
            </Grid>
        </FocusScope>
    );
}
