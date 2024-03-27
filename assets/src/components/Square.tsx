import { square } from "@/theme/recipes/square.recipe";
import { Box } from "@design-system/jsx";
import { useDroppable } from "@dnd-kit/core";
import { ErrorBoundary } from "react-error-boundary";
import { Piece } from "./Piece";

type Props = {
  squareIndex: number;
  piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P" | null;
};

export function Square(props: Readonly<Props>) {
  const { squareIndex, piece } = props;

  const { isOver, setNodeRef } = useDroppable({
    id: `square-${squareIndex}`,
    data: {
      squareIndex: squareIndex,
    },
  });

  const classes = square({
    color: ((squareIndex >> 3) ^ squareIndex) & 1 ? "light" : "dark",
    isOver: isOver,
  });

  return (
    <Box className={classes.root} tabIndex={0} data-square-index={squareIndex}>
      <Box className={classes.overlay} tabIndex={-1} />
      <Box className={classes.selected} tabIndex={-1} />

      <Box className={classes.piece} ref={setNodeRef}>
        <ErrorBoundary onError={(error, info) => console.log(error, info)} fallback={<p>Fout</p>}>
          {piece && <Piece squareIndex={squareIndex} piece={piece} />}
        </ErrorBoundary>
      </Box>
    </Box>
  );
}
