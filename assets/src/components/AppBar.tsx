import { AppBar as MUIAppBar, Box, Container, SvgIcon, Toolbar, Typography } from "@mui/material";

import { ConnectionStatus } from "./ConnectionStatus";

type Props = {
    roomCode: string;
};

export const AppBar = ({ roomCode }: Props) => {
    return (
        <Box sx={{ display: "flex" }}>
            <MUIAppBar position="fixed">
                <Container maxWidth="xl">
                    <Toolbar disableGutters>
                        <SvgIcon sx={{ display: "flex", mr: 1 }} color="secondary">
                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
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
