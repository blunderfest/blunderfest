import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @param  {...import("clsx").ClassValue} inputs
 * @returns
 */
export const classnames = (...inputs) => {
  return twMerge(clsx(inputs));
};
