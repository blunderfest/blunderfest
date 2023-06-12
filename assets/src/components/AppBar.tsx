import ChessPawn from "mdi-material-ui/ChessPawn";

import { AppBar as MUIAppBar, Box, Container, SvgIcon, Toolbar, Typography } from "@mui/material";

import { ConnectionStatus } from "./ConnectionStatus";

type Props = {
    roomCode: string;
};

export const AppBar = ({ roomCode }: Props) => {
    return (
        <Box sx={{ display: "flex" }}>
            <MUIAppBar position="fixed">
                <Container maxWidth={false}>
                    <Toolbar disableGutters>
                        <SvgIcon sx={{ display: "flex", mr: 1 }} color="secondary">
                            <ChessPawn />
                        </SvgIcon>
                        <Typography
                            variant="h6"
                            noWrap
                            component="a"
                            color="secondary"
                            sx={{
                                mr: 2,
                                display: "flex",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                letterSpacing: ".3rem",
                                textDecoration: "none",
                            }}
                        >
                            Blunderfest
                        </Typography>
                        <Box sx={{ flexGrow: 1 }}></Box>
                        <Box sx={{ flexGrow: 0 }}>
                            <ConnectionStatus roomCode={roomCode} />
                        </Box>
                    </Toolbar>
                </Container>
            </MUIAppBar>
            <Toolbar />
        </Box>
    );
};
