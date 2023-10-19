import { forwardRef } from "react";
import { Piece } from "./pieces/Piece";
import { useSquare } from "./useSquare";

export const Square = forwardRef(
  /**
   * @param {{
   *   square: Square
   * }} props
   */
  (props, ref) => {
    const { label, selected, classes, elementProps, onMark, piece } = useSquare(props.square);

    return (
      <div
        ref={ref}
        tabIndex={0}
        role="gridcell"
        aria-label={label}
        aria-selected={selected}
        className={classes.root}
        onContextMenu={(e) => onMark(e.altKey, e.ctrlKey)}
        {...elementProps}
      >
        <div className={classes.selection}>&nbsp;</div>
        <div className={classes.piece}>{piece && <Piece {...piece} />}</div>
      </div>
    );
  },
);

Square.displayName = "Square";
