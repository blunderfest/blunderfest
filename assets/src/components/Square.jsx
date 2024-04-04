import { useDroppable } from "@dnd-kit/core";
import { tv } from "tailwind-variants";
import { SvgPiece } from "./SvgPiece";

const recipe = tv({
  slots: {
    root: "z-1 relative aspect-square w-11 focus-within:border-8 focus-within:border-solid focus-within:border-blue-700 lg:w-24 focus-within:dark:border-blue-800",
    overlay: "absolute bottom-1 left-1 right-1 top-1",
    selected: "absolute bottom-0 left-0 right-0 top-0",
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
        selected: "border-8 border-solid border-blue-600 dark:border-blue-800",
      },
    },
    marked: {
      true: {
        overlay: "rounded-full border-4 border-solid border-green-600 dark:border-green-800",
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
        piece: "backdrop-brightness-150",
      },
    },
    {
      isOver: true,
      color: "light",
      class: {
        piece: "backdrop-brightness-200",
      },
    },
  ],
});

/**
 * @param {{square: Square}} props
 */
export function Square(props) {
  const { square } = props;

  const { isOver, setNodeRef } = useDroppable({
    id: `square-${square.squareIndex}`,
    data: {
      squareIndex: square.squareIndex,
    },
  });

  const classes = recipe({
    isOver: isOver,
    color: square.color,
    marked: square.squareIndex === 38 || square.squareIndex === 17,
    selected: square.squareIndex === 8 || square.squareIndex === 7,
  });

  return (
    <div className={classes.root()} data-square-index={square.squareIndex}>
      <div className={classes.overlay()} tabIndex={-1} />
      <div className={classes.selected()} tabIndex={-1} />

      <div className={classes.piece()} ref={setNodeRef}>
        {square.piece && <SvgPiece squareIndex={square.squareIndex} piece={square.piece} />}
      </div>
    </div>
  );
}
