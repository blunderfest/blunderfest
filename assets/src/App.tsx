import "./i18n";

import { Box, Container, Typography } from "@mui/material";

import { AppBar } from "./components/AppBar";

type Props = {
    roomCode: string;
};
export const App = ({ roomCode }: Props) => {
    return (
        <Box height="100vh" display="flex" flexDirection="column">
            <AppBar roomCode={roomCode} />
            <Container
                maxWidth={false}
                sx={{
                    flex: 1,
                    overflow: "auto",
                }}
            >
                <Typography variant="body1">{roomCode}</Typography>
            </Container>
        </Box>
    );
};
