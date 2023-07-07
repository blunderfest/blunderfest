import { Paper } from "@mui/material";

import { Square } from "./Square";

const ranks = Array.from({ length: 8 }).map((_, index) => 7 - index);
const files = Array.from({ length: 8 }).map((_, index) => index);

const squares = ranks.flatMap(rank => files.map(file => rank * 8 + file));

export const Board = () => {
    return (
        <Paper
            sx={{
                aspectRatio: "1/1",
                height: "100vh",
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gridTemplateRows: "repeat(8, 1fr)",
                padding: 5,
                borderColor: theme => theme.vars.palette.primary.light,
                borderWidth: 5,
                borderStyle: "solid",
            }}
            elevation={1}
        >
            {squares.map(square => (
                <Square key={square} index={square} />
            ))}
        </Paper>
    );
};
