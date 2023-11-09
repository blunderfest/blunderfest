import { Draggable } from "@/components/Draggable";
import { useAppDispatch, useAppSelector } from "@/store";
import { markSquare } from "@/store/actions";
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
    const position = useAppSelector((state) => state.position.entities[positionId]);
    const marks = useAppSelector((state) => state.marks.byPositionId[positionId][parsedSquare.squareIndex]);

    const { elementProps, isFocusVisible } = useSquareAria(positionId, parsedSquare);
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
      id: parsedSquare.squareIndex,
    });

    if (!position) {
      return <></>;
    }

    const classes = square({
      focussed: isFocusVisible,
      color: parsedSquare.color,
      marked: marks,
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
            dispatch(markSquare(positionId, parsedSquare.squareIndex, e.altKey ? "alt" : e.ctrlKey ? "ctrl" : "simple"));
          }
        }}>
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
              recipe={(dragging) => pieceRecipe({ dragging: dragging })}>
              <Piece piece={parsedSquare.piece} />
            </Draggable>
          )}
        </div>
      </div>
    );
  };
