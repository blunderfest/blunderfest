import { useDroppable } from "@dnd-kit/core";
import { ErrorBoundary } from "react-error-boundary";
import { Box } from "styled-system/jsx";
import { squareRecipe } from "~/components/recipes/square.recipe";
import { Square as S } from "~/types/Piece";
import { SvgPiece } from "./SvgPiece";

type Props = {
  square: S;
};

export function Square(props: Readonly<Props>) {
  const { square } = props;

  const { isOver, setNodeRef } = useDroppable({
    id: `square-${square.squareIndex}`,
    data: {
      squareIndex: square.squareIndex,
    },
  });

  const classes = squareRecipe({
    color: ((square.squareIndex >> 3) ^ square.squareIndex) & 1 ? "light" : "dark",
    isOver: isOver,
  });

  return (
    <Box className={classes.root} tabIndex={0} data-square-index={square.squareIndex}>
      <Box className={classes.overlay} tabIndex={-1} />
      <Box className={classes.selected} tabIndex={-1} />

      <Box className={classes.piece} ref={setNodeRef}>
        <ErrorBoundary onError={(error, info) => console.log(error, info)} fallback={<p>Fout</p>}>
          {square.piece && <SvgPiece squareIndex={square.squareIndex} piece={square.piece} />}
        </ErrorBoundary>
      </Box>
    </Box>
  );
}
