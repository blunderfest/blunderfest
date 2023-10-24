import { useAppDispatch, useAppSelector } from "@/store";
import { mark, select } from "@/store/board";
import { forwardRef } from "react";
import { mergeProps, useFocusRing, useLongPress, usePress } from "react-aria";
import { Piece } from "./pieces/Piece";
import { squareRecipe } from "./squareRecipe";

export const Square = forwardRef(
  /**
   * @param {{
   *   square: Square
   * }} props
   */
  (props, ref) => {
    const { square } = props;

    const dispatch = useAppDispatch();
    const board = useAppSelector((state) => state.board);

    const { longPressProps } = useLongPress({
      onLongPress: () => {
        cycle();
      },
    });

    const { pressProps } = usePress({
      onPress: (e) => {
        if (e.pointerType === "keyboard" && e.ctrlKey) {
          cycle();
        } else {
          dispatch(select(square.squareIndex));
        }
      },
    });

    const { focusProps, isFocusVisible } = useFocusRing({
      within: true,
    });

    const cycle = () => {
      const marks = /** @type {Array<Mark>} */ (["none", "simple", "alt", "ctrl"]);
      const currentMark = marks.indexOf(board.marks[square.squareIndex]);
      const nextMark = marks[(currentMark + 1) % marks.length];

      dispatch(mark(square.squareIndex, nextMark));
    };

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
        {...mergeProps(longPressProps, pressProps, focusProps)}
        onContextMenu={(e) => {
          if (!e.defaultPrevented) {
            e.preventDefault();
            dispatch(mark(square.squareIndex, e.altKey ? "alt" : e.ctrlKey ? "ctrl" : "simple"));
          }
        }}
      >
        <div className={classes.selection}>&nbsp;</div>
        <div className={classes.piece}>{square.piece && <Piece {...square.piece} />}</div>
      </div>
    );
  },
);

Square.displayName = "Square";
