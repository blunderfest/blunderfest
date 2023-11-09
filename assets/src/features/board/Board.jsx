import { useAppDispatch, useAppSelector } from "@/store";
import { movePiece, resetPosition } from "@/store/actions";
import { DndContext } from "@dnd-kit/core";
import { useRef } from "react";
import { useClickAway } from "react-use";
import { Grid } from "styled-system/jsx";
import { Square } from "./Square";
import { useBoardAria } from "./aria";

/**
 * @param {{
 *   gameId: string,
 *   positionId: string
 * }} props
 */
export function Board(props) {
  const { gameId, positionId } = props;

  const dispatch = useAppDispatch();
  const position = useAppSelector((state) => state.position.entities[positionId]);
  const ref = useRef(null);

  useClickAway(ref, (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    if (!target || !target.onclick || typeof target.onclick !== "function") {
      dispatch(resetPosition(positionId));
    }
  });

  const { squareRefs, keyboardProps } = useBoardAria();

  /**
   * @param {import("@dnd-kit/core").DragEndEvent} event
   */
  function handleDragEnd(event) {
    const { active, over } = event;

    if (over) {
      const from = Number(active.id);
      const to = Number(over.id);

      if (from !== to) {
        dispatch(
          movePiece(gameId, positionId, {
            from: from,
            to: to,
          }),
        );
      }
    }
  }

  return (
    <DndContext onDragEnd={(e) => handleDragEnd(e)}>
      <Grid
        role="grid"
        aria-colcount={8}
        aria-rowcount={8}
        ref={ref}
        columns={8}
        rowGap={0}
        columnGap={0}
        height={{
          base: "auto",
          lg: "100vh",
        }}
        width={{
          base: "100vw",
          lg: "auto",
        }}
        aspectRatio="square"
        {...keyboardProps}>
        {position?.squares.map((square, index) => (
          <Square
            key={square.file + square.rank}
            setNodeRef={(node) => (squareRefs.current[index] = node)}
            positionId={positionId}
            parsedSquare={square}
          />
        ))}
      </Grid>
    </DndContext>
  );
}
