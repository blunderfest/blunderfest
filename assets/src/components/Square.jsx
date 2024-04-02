import { useDroppable } from "@dnd-kit/core";
import { tv } from "tailwind-variants";
import { SvgPiece } from "./SvgPiece";

const recipe = tv({
  slots: {
    root: "z-1 relative aspect-square",
    overlay: "absolute bottom-2 left-2 right-2 top-2",
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
        selected: "border-4 border-solid border-blue-700 dark:border-blue-800",
      },
    },
    focussed: {
      true: {
        selected: "border-4 border-solid border-blue-700 dark:border-blue-800",
      },
    },
    marked: {
      true: {
        overlay: "rounded-full border-8 border-solid border-green-600 dark:border-green-800",
      },
    },
    isOver: {
      true: {
        piece: "bg-yellow-300 dark:bg-yellow-400",
      },
    },
  },
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
