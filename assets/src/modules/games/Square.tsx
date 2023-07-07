import { Box, useTheme } from "@mui/material";

type Props = {
    index: number;
};

export const Square = (props: Props) => {
    const { index } = props;
    const rank = index >>> 3;
    const file = index & 7;

    const theme = useTheme();
    const background = rank % 2 === file % 2 ? theme.vars.palette.board.light : theme.vars.palette.board.dark;

    return (
        <Box key={`${rank}${file}`} sx={{ aspectRatio: "1/1", background: background }}>
            ({file}, {rank})
        </Box>
    );
};
