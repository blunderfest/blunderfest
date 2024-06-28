import { useAppSelector } from "@/store/hooks";
import { tv } from "tailwind-variants";
import { SvgPiece } from "./pieces/SvgPiece";
import { motion } from "framer-motion";

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
      className: "bg-blue-400/50 dark:bg-blue-400/25",
    },
    {
      highlighted: true,
      color: "light",
      className: "bg-blue-400/50 dark:bg-blue-400/15",
    },
  ],
});

export function Square(props: Readonly<{ squareIndex: number }>) {
  const square = useAppSelector((state) => state.board.squares[props.squareIndex]);
  const styles = recipe(square);

  return (
    <motion.div className={styles.base()} onDragOver={() => console.log(props.squareIndex)}>
      <div className={styles.highlighted()}></div>
      <div className={styles.selected()}></div>
      <div className={styles.piece()}>
        <SvgPiece piece={square.piece} />
      </div>
    </motion.div>
  );
}
