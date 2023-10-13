import { useAppDispatch, useAppSelector } from "@/store";
import { mark, select } from "./boardSlice";
import { Piece } from "./pieces/Piece";
import { squareRecipe } from "./squareRecipe";

/**
 * @param {{
 *     square: Square
 * }} props
 * @returns
 */

export const Square = (props) => {
  const { square } = props;

  const dispatch = useAppDispatch();
  const selectedSquare = useAppSelector((state) => state.board.selectedSquare);

  const classes = squareRecipe({
    color: square.color,
    selected: square.mark !== "none" ? square.mark : selectedSquare === square.squareIndex ? "highlighted" : "none",
  });

  return (
    <div
      className={classes.root}
      onClick={() => dispatch(select(square.squareIndex))}
      onContextMenu={(e) => {
        dispatch(
          mark({
            square: square.squareIndex,
            alt: e.altKey,
            ctrl: e.ctrlKey,
          }),
        );
      }}
    >
      <div className={classes.selection}>&nbsp;</div>
      <div className={classes.piece}>{square.piece && <Piece {...square.piece} />}</div>
    </div>
  );
};
