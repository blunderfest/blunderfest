import { ComponentProps } from "react";
import { VariantProps, tv } from "tailwind-variants";

const square = tv({
  base: "relative aspect-square",
  slots: {
    piece: "absolute h-full w-full cursor-pointer",
    selected: "absolute h-full w-full",
    highlighted: "absolute h-full w-full",
  },
  variants: {
    color: {
      dark: {
        base: "bg-neutral-900 dark:bg-neutral-800",
      },
      light: {
        base: "bg-neutral-200 dark:bg-neutral-400",
      },
    },
    selected: {
      true: {
        selected: "border-4 border-blue-800",
      },
    },
    highlighted: {
      true: {},
    },
  },
  compoundVariants: [
    {
      highlighted: true,
      color: "dark",
      className: "bg-blue-400/50 dark:bg-blue-400/25",
    },
    {
      highlighted: true,
      color: "light",
      className: "bg-blue-400/50 dark:bg-blue-400/15",
    },
  ],
});

type SquareVariants = VariantProps<typeof square>;

export function Square(props: SquareVariants & ComponentProps<"div">) {
  const { base, piece, selected, highlighted } = square(props);

  return (
    <div className={base()} {...props}>
      <div className={highlighted()}></div>
      <div className={selected()}></div>
      <div className={piece()}></div>
    </div>
  );
}
