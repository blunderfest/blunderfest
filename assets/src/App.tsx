import { Paper, Typography } from "@mui/material";

import { AppBar } from "./components/AppBar";

type Props = {
    roomCode: string;
};
export const App = ({ roomCode }: Props) => {
    return (
        <>
            <AppBar roomCode={roomCode} />
            <Paper elevation={1}>
                <Typography variant="body1">{roomCode}</Typography>
            </Paper>
        </>
    );
};
