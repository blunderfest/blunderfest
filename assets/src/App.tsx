import { useState } from "react";
import { tv } from "tailwind-variants";

const button2 = tv(
  {
    base: "font-semibold text-white py-1 px-3 rounded-full active:opacity-80",
    variants: {
      color: {
        primary: "bg-blue-500 hover:bg-blue-700",
        secondary: "bg-purple-500 hover:bg-purple-700",
        success: "bg-green-500 hover:bg-green-700",
        error: "bg-red-500 hover:bg-red-700",
      },
    },
  },
  {
    responsiveVariants: ["sm", "md"], // `true` to apply to all screen sizes
  }
);

export function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1 className="text-3xl font-bold underline">Hello world!</h1>
      <h1>Vite + React</h1>
      <div className="card">
        <button
          className={button2({
            color: {
              initial: "primary",
              sm: "success",
              md: "error",
            },
          })}>
          Click me
        </button>
        <button
          className={button2({
            color: {
              initial: "primary",
              sm: "success",
              md: "error",
            },
          })}
          onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
    </>
  );
}
