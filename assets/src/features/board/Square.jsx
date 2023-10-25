import { useAppDispatch, useAppSelector } from "@/store";
import { mark } from "@/store/board";
import { forwardRef } from "react";
import { useSquareAria } from "./aria";
import { Piece } from "./pieces/Piece";
import { squareRecipe } from "./squareRecipe";

export const Square = forwardRef(
  /**
   * @param {{
   *   square: ParsedSquare
   * }} props
   */
  (props, ref) => {
    const { square } = props;

    const dispatch = useAppDispatch();
    const board = useAppSelector((state) => state.board);
    const { elementProps, isFocusVisible } = useSquareAria(square);

    const classes = squareRecipe({
      focussed: isFocusVisible,
      color: square.color,
      selected:
        board.marks[square.squareIndex] !== "none"
          ? board.marks[square.squareIndex]
          : board?.selectedSquare === square.squareIndex
          ? "highlighted"
          : "none",
    });

    return (
      <div
        ref={ref}
        tabIndex={0}
        role="gridcell"
        aria-label={square.file + square.rank}
        aria-selected={board.selectedSquare === square.squareIndex}
        className={classes.root}
        {...elementProps}
        onContextMenu={(e) => {
          if (!e.defaultPrevented) {
            e.preventDefault();
            dispatch(mark(square.squareIndex, e.altKey ? "alt" : e.ctrlKey ? "ctrl" : "simple"));
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
