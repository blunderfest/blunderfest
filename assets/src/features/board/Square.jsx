import { Draggable } from "@/components/Draggable";
import { useAppDispatch, useAppSelector } from "@/store";
import { mark } from "@/store/positions";
import { useDroppable } from "@dnd-kit/core";
import { cva } from "styled-system/css";
import { square } from "styled-system/recipes";
import { useSquareAria } from "./aria";
import { Piece } from "./pieces/Piece";

const pieceRecipe = cva({
  base: {
    position: "relative",
  },
  variants: {
    dragging: {
      true: {
        cursor: "grab",
        zIndex: 1000,
      },
    },
  },
});

export const Square =
  /**
   * @param {{
   *   positionId: string,
   *   parsedSquare: ParsedSquare,
   *   setNodeRef: (element: HTMLElement | null) => void
   * }} props
   */
  (props) => {
    const { positionId, parsedSquare, setNodeRef } = props;

    const dispatch = useAppDispatch();
    const position = useAppSelector((state) => state.position.byId[positionId]);
    const { elementProps, isFocusVisible } = useSquareAria(positionId, parsedSquare);
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
      id: parsedSquare.squareIndex,
    });

    const classes = square({
      focussed: isFocusVisible,
      color: parsedSquare.color,
      marked: position.marks[parsedSquare.squareIndex] ?? "none",
      highlighted: position.selectedSquareIndex === parsedSquare.squareIndex,
      draggedOver: isOver,
    });

    return (
      <div
        ref={(node) => {
          setDroppableRef(node);
          setNodeRef(node);
        }}
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
        <div tabIndex={-1} className={classes.highlight}>
          &nbsp;
        </div>
        <div tabIndex={-1} className={classes.mark}>
          &nbsp;
        </div>
        <div className={classes.piece}>
          {parsedSquare.piece && (
            <Draggable
              id={parsedSquare.squareIndex.toString()}
              data={{ piece: parsedSquare.piece }}
              recipe={(dragging) => pieceRecipe({ dragging: dragging })}
            >
              <Piece piece={parsedSquare.piece} />
            </Draggable>
          )}
          {parsedSquare.squareIndex}
        </div>
      </div>
    );
  };
