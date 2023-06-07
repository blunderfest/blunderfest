import { useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

export const App: React.FC<{gameCode: string}> = ({gameCode}) => {
  const [count, setCount] = useState(0)

  const handleOnClick = async () => {
    const response = await fetch("/api");
    const data = await response.json();

    console.log(data);
  }

  return (
    <>
      <div>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <button onClick={() => handleOnClick()}>Click {gameCode}</button>
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
  )
}
