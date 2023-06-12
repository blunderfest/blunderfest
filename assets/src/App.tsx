import { useEffect, useState } from "react";

import { Button } from "@mui/material";

import reactLogo from "./assets/react.svg";
import { useStore } from "./store";

type Props = {
    roomCode: string;
};

export const App = ({ roomCode }: Props) => {
    const countStore = useStore(state => state.count);
    const channelStore = useStore(state => state.channel);
    const [data, setData] = useState({ data: "" });

    useEffect(() => {
        if (!channelStore.ready) {
            channelStore.connect(roomCode);
        }
    }, [channelStore, channelStore.ready, roomCode]);

    const handleOnClick = async () => {
        const response = await fetch("/api");
        const data = await response.json();

        setData(data);
    };

    return (
        <>
            <div>
                <a href="https://react.dev">
                    <img src={reactLogo} className="logo react" alt="React logo" />
                </a>
            </div>
            <Button
                variant="contained"
                color="primary"
                onClick={() => channelStore.connect(roomCode)}
                disabled={channelStore.ready}
            >
                Connect
            </Button>

            <Button
                variant="contained"
                color="secondary"
                onClick={() => channelStore.disconnect()}
                disabled={!channelStore.ready}
            >
                Disonnect
            </Button>

            <Button variant="contained" color="secondary" onClick={() => handleOnClick()} disabled={!channelStore.ready}>
                Click {roomCode}
            </Button>
            <div>Data returned: {data.data}</div>
            <h1>Vite + React + Phoenix</h1>
            <div className="card">
                <Button onClick={() => countStore.increment()} variant="contained">
                    count is {countStore.count}
                </Button>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
};
