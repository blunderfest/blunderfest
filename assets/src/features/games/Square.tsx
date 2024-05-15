import { Piece, SquareIndex } from "@/types";
import { tv } from "tailwind-variants";
import { SvgPiece } from "./SvgPiece";

const recipe = tv({
  slots: {
    root: "z-1 group relative size-6 md:size-7 lg:size-28",
    highlighting: "absolute bottom-0 left-0 right-0 top-0",
    marking: "absolute bottom-1 left-1 right-1 top-1",
    selection: "absolute bottom-0 left-0 right-0 top-0",
    piece: "absolute bottom-0 left-0 right-0 top-0",
  },
  variants: {
    color: {
      dark: {
        root: "bg-neutral-600 dark:bg-neutral-700",
      },
      light: {
        root: "dark:bg-neutral-90 bg-neutral-100",
      },
    },
    selected: {
      true: {
        selection: "border-2 border-solid border-blue-600 md:border-4 lg:border-8 dark:border-blue-800",
      },
    },
    marked: {
      true: {
        marking: "rounded-full border-2 border-solid border-green-600 md:border-4 lg:border-8 dark:border-green-800",
      },
    },
    isOver: {
      true: {},
    },
  },
  compoundVariants: [
    {
      isOver: true,
      color: "dark",
      class: {
        highlighting: "backdrop-brightness-150",
      },
    },
    {
      isOver: true,
      color: "light",
      class: {
        highlighting: "backdrop-brightness-200",
      },
    },
  ],
});

export function Square(props: Readonly<{ squareIndex: SquareIndex; piece?: Piece }>) {
  const color = ((9 * props.squareIndex) & 8) == 0 ? "dark" : "light";

  const classes = recipe({
    isOver: false,
    color: color,
    marked: props.squareIndex === 38 || props.squareIndex === 17,
    selected: props.squareIndex === 8 || props.squareIndex === 7,
  });

  return (
    <button className={classes.root()} data-square-index={props.squareIndex} aria-label="Some label" aria-pressed="false">
      <div className={classes.highlighting()} tabIndex={-1} />
      <div className={classes.marking()} tabIndex={-1} />
      <div className={classes.selection()} tabIndex={-1} />
      <div className={classes.piece()}>{props.piece && <SvgPiece squareIndex={props.squareIndex} piece={props.piece} />}</div>
    </button>
  );
}
