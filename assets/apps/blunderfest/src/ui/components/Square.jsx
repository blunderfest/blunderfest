import { Box } from "@blunderfest/design-system/styled-system/jsx";
import { square } from "@blunderfest/ui/recipes";
import { useDroppable } from "@dnd-kit/core";
import PropTypes from "prop-types";
import { Piece } from "./Piece";

/**
 * @param {{
 *    squareIndex: number,
 *    piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P" | null
 * }} props
 */
export function Square(props) {
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
        {piece && <Piece squareIndex={squareIndex} piece={piece} />}
      </Box>
    </Box>
  );
}

Square.propTypes = {
  squareIndex: PropTypes.number.isRequired,
  piece: PropTypes.oneOf(["k", "K", "q", "Q", "r", "R", "b", "B", "n", "N", "p", "P", null]),
};
