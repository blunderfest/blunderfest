import { useAppSelector } from "@/store/hooks";
import { tv } from "tailwind-variants";
import { SvgPiece } from "./pieces/SvgPiece";
import { useDroppable } from "@dnd-kit/core";
import { selectSquare } from "./boardSlice";

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
  const square = useAppSelector((state) => selectSquare(state, "some_game", props.squareIndex));

  const { isOver, setNodeRef } = useDroppable({
    id: String(props.squareIndex),
    data: {
      squareIndex: props.squareIndex,
    },
  });

  const styles = recipe({
    color: square.color,
    highlighted: isOver,
  });

  return (
    <div ref={setNodeRef} className={styles.base()}>
      <div className={styles.highlighted()}></div>
      <div className={styles.selected()}></div>
      <div className={styles.piece()}>
        <SvgPiece
          data={{
            squareIndex: props.squareIndex,
          }}
          piece={square.piece}
        />
      </div>
    </div>
  );
}
