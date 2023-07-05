import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "~/modules/hooks";

import { Box, Container } from "@mui/material";

import { connectivityActions } from "./modules/connectivity";

type Props = {
    roomCode: string;
};

export const App = ({ roomCode }: Props) => {
    const users = useAppSelector(state => state.connectivity.users);
    const connectivityStatus = useAppSelector(state => state.connectivity.status);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (connectivityStatus === "offline") {
            dispatch(connectivityActions.connect(roomCode));
        }
    });

    return (
        <Box height="100vh" display="flex" flexDirection="column">
            <Container
                maxWidth={false}
                sx={{
                    flex: 1,
                    overflow: "auto",
                }}
            >
                Status: {connectivityStatus}
                <ul>
                    {Object.keys(users)
                        .map(element => users[element])
                        .map(user => (
                            <li key={user.metas[0].user_id}>
                                {user.metas[0].user_id}: {new Date(user.metas[0].online_at).toISOString()}
                            </li>
                        ))}
                </ul>
            </Container>
        </Box>
    );
};
