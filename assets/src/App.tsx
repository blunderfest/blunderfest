import reactLogo from "./assets/react.svg";
import { Button } from "@mui/material";
import { useStore } from "./store";
import { useState } from "react";

type Props = {
    roomCode: string;
};

export const App = ({ roomCode }: Props) => {
    const countStore = useStore(state => state.count);
    const channelStore = useStore(state => state.channel);
    const [data, setData] = useState({ data: "" });

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
            <Button variant="contained" color="secondary" onClick={() => handleOnClick()} disabled={!channelStore.ready}>
                Click {roomCode}
            </Button>
            <div>Data returned: {data.data}</div>
            <h1>Vite + React + Phoenix</h1>
            <div className="card">
                <Button onClick={() => countStore.increment()} variant="contained">
                    count is {countStore.count}
                </Button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
};
