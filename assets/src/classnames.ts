import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const classnames = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};
