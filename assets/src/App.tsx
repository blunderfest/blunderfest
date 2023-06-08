import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { Button } from "@mui/material";
import { socket } from "./socket";

type Props = {
    gameCode: string;
};

const channel = socket.channel("room:lobby", {});
channel
    .join()
    .receive("ok", resp => {
        console.log("Joined successfully", resp);
    })
    .receive("error", resp => {
        console.log("Unable to join", resp);
    });

export const App = ({ gameCode }: Props) => {
    const [count, setCount] = useState(0);

    const handleOnClick = async () => {
        const response = await fetch("/api");
        const data = await response.json();

        console.log(data);
    };

    return (
        <>
            <div>
                <a href="https://react.dev">
                    <img src={reactLogo} className="logo react" alt="React logo" />
                </a>
            </div>
            <Button variant="outlined" color="secondary" onClick={() => handleOnClick()}>
                Click {gameCode}
            </Button>
            <h1>Vite + React</h1>
            <div className="card">
                <Button onClick={() => setCount(count => count + 1)} variant="contained">
                    count is {count}
                </Button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
};
