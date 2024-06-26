import { ComponentProps, PropsWithChildren } from "react";
import { VariantProps, tv } from "tailwind-variants";

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

type ButtonVariants = VariantProps<typeof button>;

export function Button(props: ButtonVariants & PropsWithChildren & ComponentProps<"button">) {
  return <button className={button(props)}>{props.children}</button>;
}
