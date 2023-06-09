import reactLogo from "./assets/react.svg";
import { Button } from "@mui/material";
import { useStore } from "./store";

type Props = {
    gameCode: string;
};

export const App = ({ gameCode }: Props) => {
    const countStore = useStore(state => state.count);
    const channelStore = useStore(state => state.channel);

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
            <Button variant="contained" color="primary" onClick={() => channelStore.connect()} disabled={channelStore.ready}>
                Connect
            </Button>
            <Button variant="contained" color="secondary" onClick={() => handleOnClick()} disabled={!channelStore.ready}>
                Click {gameCode}
            </Button>
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
