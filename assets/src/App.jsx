import { useState } from "react";
import { tv } from "tailwind-variants";
import { Counter } from "./features/counter/Counter";
import { classnames } from "./classnames";

const button = tv({
  base: "rounded-full bg-blue-500 font-medium text-white active:opacity-80",
  variants: {
    color: {
      primary: "bg-primary text-white",
      secondary: "bg-secondary text-white",
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

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="h-screen w-screen bg-background text-text antialiased">
      <h1 className="text-lg font-bold text-red-600">Vite + React</h1>
      <div className="card">
        <Counter />
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <button className={button({ size: "sm", color: "secondary" })}>Click me</button>
      <button className={button({ size: "sm", color: "primary" })}>Click me</button>
      <p className={classnames("h-10", "size-5", "bg-blue-50", "border", "w-10")}>
        Click on the Vite and React logos to learn more
      </p>
    </div>
  );
}
