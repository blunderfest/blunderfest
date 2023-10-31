import { useAppDispatch, useAppSelector } from "@/store";
import { mark } from "@/store/positions";
import { forwardRef } from "react";
import { square } from "styled-system/recipes";
import { useSquareAria } from "./aria";
import { Piece } from "./pieces/Piece";

export const Square = forwardRef(
  /**
   * @param {{
   *   positionId: string,
   *   parsedSquare: ParsedSquare
   * }} props
   */
  (props, ref) => {
    const { positionId, parsedSquare } = props;

    const dispatch = useAppDispatch();
    const position = useAppSelector((state) => state.position.byId[positionId]);
    const { elementProps, isFocusVisible } = useSquareAria(positionId, parsedSquare);

    const classes = square({
      focussed: isFocusVisible,
      color: parsedSquare.color,
      marked: position.marks[parsedSquare.squareIndex] ?? "none",
      highlighted: position.selectedSquareIndex === parsedSquare.squareIndex,
    });

    return (
      <div
        ref={ref}
        tabIndex={0}
        role="gridcell"
        aria-label={parsedSquare.file + parsedSquare.rank}
        aria-selected={position.selectedSquareIndex === parsedSquare.squareIndex}
        className={classes.root}
        {...elementProps}
        onContextMenu={(e) => {
          if (!e.defaultPrevented) {
            e.preventDefault();
            dispatch(mark(positionId, parsedSquare.squareIndex, e.altKey ? "alt" : e.ctrlKey ? "ctrl" : "simple"));
          }
        }}
      >
        <div className={classes.highlight}>&nbsp;</div>
        <div className={classes.mark}>&nbsp;</div>
        <div className={classes.piece}>{parsedSquare.piece && <Piece piece={parsedSquare.piece} />}</div>
      </div>
    );
  },
);

Square.displayName = "Square";
