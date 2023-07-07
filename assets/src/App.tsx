import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "~/modules/hooks";

import { Box, Container } from "@mui/material";

import { connectivityActions } from "./modules/connectivity";
import { Board } from "./modules/games";

type Props = {
    roomCode: string;
};

export const App = (props: Props) => {
    const { roomCode } = props;
    const users = useAppSelector(state => state.connectivity.users);
    const connectivityStatus = useAppSelector(state => state.connectivity.status);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (connectivityStatus === "offline") {
            dispatch(connectivityActions.connect(roomCode));
        }
    });

    return (
        <Container maxWidth={false} sx={{ display: "flex", flexDirection: "row", justifyContent: "center" }}>
            <Box sx={{ height: "100vh", flexBasis: "20%", flexGrow: 0 }}>Status: {connectivityStatus}</Box>
            <Box sx={{ height: "100vh" }}>
                <Board />
            </Box>
            <Box sx={{ height: "100vh", flexBasis: "20%", flexGrow: 0 }}>
                <ul>
                    {Object.keys(users)
                        .map(element => users[element])
                        .map(user => (
                            <li key={user.metas[0].user_id}>
                                {user.metas[0].user_id}: {new Date(user.metas[0].online_at).toISOString()}
                            </li>
                        ))}
                </ul>
            </Box>
        </Container>
    );
};
