import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @param  {...import("clsx").ClassValue} inputs
 * @returns
 */
export const cn = (...inputs) => {
  return twMerge(clsx(inputs));
};
