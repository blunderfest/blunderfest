import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { Socket } from "phoenix";
import "./App.css";

const socket = new Socket("/socket", { params: { token: window.userToken } });
socket.connect();

const channel = socket.channel("room:42", {});
channel
  .join()
  .receive("ok", (resp) => {
    console.log("Joined successfully", resp);
    channel.push("Some event", {});

    setTimeout(() => {
      channel.push("Again", {});
      console.log(channel.state);
    }, 2000);
  })
  .receive("error", (resp) => {
    console.log("Unable to join", resp);
  });

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
