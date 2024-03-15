import { button } from "./button.recipe";

export const Button = () => {
  return (
    <button className={button({ visual: "solid", size: "lg" })}>
      Click Me
    </button>
  );
};
