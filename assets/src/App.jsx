import { useState } from "react";
import { Counter } from "./features/counter/Counter";
import { tv } from "tailwind-variants";
import { cn } from "./cn";

const button = tv({
  base: "rounded-full bg-blue-500 font-medium text-white active:opacity-80",
  variants: {
    color: {
      primary: "bg-blue-500 text-white",
      secondary: "bg-purple-500 text-white",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "px-4 py-3 text-lg",
    },
  },
  compoundVariants: [
    {
      size: ["sm", "md"],
      class: "px-3 py-1",
    },
  ],
  defaultVariants: {
    size: "md",
    color: "primary",
  },
});

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div></div>
      <h1 className="font-bold text-lg text-red-600">Vite + React</h1>
      <div className="card">
        <Counter />
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <button className={button({ size: "sm", color: "secondary" })}>Click me</button>
      <button className={button({ size: "sm", color: "primary" })}>Click me</button>
      <p className={cn("h-10", "size-5", "bg-blue-50", "border", "w-10")}>Click on the Vite and React logos to learn more</p>
    </>
  );
}

export default App;
