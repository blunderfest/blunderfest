import { useAppDispatch, useAppSelector } from "@/store";
import { mark } from "@/store/positions";
import { forwardRef } from "react";
import { useSquareAria } from "./aria";
import { Piece } from "./pieces/Piece";
import { squareRecipe } from "./squareRecipe";

export const Square = forwardRef(
  /**
   * @param {{
   *   positionId: string,
   *   square: ParsedSquare
   * }} props
   */
  (props, ref) => {
    const { positionId, square } = props;

    const dispatch = useAppDispatch();
    const position = useAppSelector((state) => state.position.byId[positionId]);
    const { elementProps, isFocusVisible } = useSquareAria(positionId, square);

    const classes = squareRecipe({
      focussed: isFocusVisible,
      color: square.color,
      selected:
        position.marks[square.squareIndex] !== "none"
          ? position.marks[square.squareIndex]
          : position?.selectedSquareIndex === square.squareIndex
          ? "highlighted"
          : "none",
    });

    return (
      <div
        ref={ref}
        tabIndex={0}
        role="gridcell"
        aria-label={square.file + square.rank}
        aria-selected={position.selectedSquareIndex === square.squareIndex}
        className={classes.root}
        {...elementProps}
        onContextMenu={(e) => {
          if (!e.defaultPrevented) {
            e.preventDefault();
            dispatch(mark(positionId, square.squareIndex, e.altKey ? "alt" : e.ctrlKey ? "ctrl" : "simple"));
          }
        }}
      >
        <div className={classes.selection}>&nbsp;</div>
        <div className={classes.piece}>{square.piece && <Piece piece={square.piece} />}</div>
      </div>
    );
  },
);

Square.displayName = "Square";
