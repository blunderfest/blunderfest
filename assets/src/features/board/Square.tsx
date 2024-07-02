import { useAppSelector } from "@/store/hooks";
import { tv } from "tailwind-variants";
import { SvgPiece } from "./pieces/SvgPiece";
import { useDroppable } from "@dnd-kit/core";

const recipe = tv({
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
      className: {
        highlighted: "bg-yellow-400/80 dark:bg-yellow-400/70",
      },
    },
    {
      highlighted: true,
      color: "light",
      className: {
        highlighted: "bg-yellow-400/50 dark:bg-yellow-400/50",
      },
    },
  ],
});

export function Square(props: Readonly<{ squareIndex: number }>) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${props.squareIndex}`,
  });

  const square = useAppSelector((state) => state.board.squares[props.squareIndex]);
  const styles = recipe({
    color: square.color,
    highlighted: isOver,
  });

  return (
    <div ref={setNodeRef} className={styles.base()}>
      <div className={styles.highlighted()}></div>
      <div className={styles.selected()}></div>
      <div className={styles.piece()}>
        <SvgPiece id={`${props.squareIndex}`} piece={square.piece} />
      </div>
    </div>
  );
}
